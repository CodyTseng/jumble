import { BIG_RELAY_URLS } from '@/constants'
import { getProfileFromProfileEvent, getRelayListFromRelayListEvent } from '@/lib/event'
import { formatPubkey, userIdToPubkey } from '@/lib/pubkey'
import { extractPubkeysFromEventTags } from '@/lib/tag'
import { isLocalNetworkUrl } from '@/lib/url'
import { TDraftEvent, TProfile, TRelayList } from '@/types'
import { sha256 } from '@noble/hashes/sha2'
import DataLoader from 'dataloader'
import FlexSearch from 'flexsearch'
import { LRUCache } from 'lru-cache'
import {
  EventTemplate,
  Filter,
  kinds,
  Event as NEvent,
  nip19,
  SimplePool,
  VerifiedEvent
} from 'nostr-tools'
import { SubscribeManyParams } from 'nostr-tools/abstract-pool'
import { AbstractRelay } from 'nostr-tools/abstract-relay'
import indexedDb from './indexed-db.service'

type TTimelineRef = [string, number]

class ClientService extends EventTarget {
  static instance: ClientService

  signer?: (evt: TDraftEvent) => Promise<VerifiedEvent>
  private currentRelayUrls: string[] = []
  private pool: SimplePool

  private timelines: Record<
    string,
    | {
        refs: TTimelineRef[]
        filter: Omit<Filter, 'since' | 'until'> & { limit: number }
        urls: string[]
      }
    | undefined
  > = {}
  private eventCache = new LRUCache<string, Promise<NEvent | undefined>>({ max: 10000 })
  private eventDataLoader = new DataLoader<string, NEvent | undefined>(
    (ids) => Promise.all(ids.map((id) => this._fetchEvent(id))),
    { cacheMap: this.eventCache }
  )
  private fetchEventFromBigRelaysDataloader = new DataLoader<string, NEvent | undefined>(
    this.fetchEventsFromBigRelays.bind(this),
    { cache: false, batchScheduleFn: (callback) => setTimeout(callback, 200) }
  )
  private fetchProfileEventFromBigRelaysDataloader = new DataLoader<string, NEvent | undefined>(
    this.profileEventBatchLoadFn.bind(this),
    {
      batchScheduleFn: (callback) => setTimeout(callback, 200),
      cacheMap: new LRUCache<string, Promise<NEvent | undefined>>({ max: 1000 }),
      maxBatchSize: 20
    }
  )
  private relayListEventDataLoader = new DataLoader<string, NEvent | undefined>(
    this.relayListEventBatchLoadFn.bind(this),
    {
      batchScheduleFn: (callback) => setTimeout(callback, 200),
      cacheMap: new LRUCache<string, Promise<NEvent | undefined>>({ max: 1000 }),
      maxBatchSize: 20
    }
  )
  private followListCache = new LRUCache<string, Promise<NEvent | undefined>>({
    max: 2000,
    fetchMethod: this._fetchFollowListEvent.bind(this)
  })

  private userIndex = new FlexSearch.Index({
    tokenize: 'forward'
  })

  constructor() {
    super()
    this.pool = new SimplePool()
    this.pool.trackRelays = true
  }

  public static getInstance(): ClientService {
    if (!ClientService.instance) {
      ClientService.instance = new ClientService()
      ClientService.instance.init()
    }
    return ClientService.instance
  }

  async init() {
    await indexedDb.iterateProfileEvents((profileEvent) => this.addUsernameToIndex(profileEvent))
  }

  listConnectionStatus() {
    return this.pool.listConnectionStatus()
  }

  setCurrentRelayUrls(urls: string[]) {
    this.currentRelayUrls = urls
  }

  getCurrentRelayUrls() {
    return this.currentRelayUrls
  }

  async publishEvent(relayUrls: string[], event: NEvent) {
    const uniqueRelayUrls = Array.from(new Set(relayUrls))
    const result = await Promise.any(
      uniqueRelayUrls.map(async (url) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this
        const relay = await this.pool.ensureRelay(url)
        return relay
          .publish(event)
          .then((reason) => {
            this.trackEventSeenOn(event.id, relay)
            return reason
          })
          .catch((error) => {
            if (
              error instanceof Error &&
              error.message.startsWith('auth-required:') &&
              !!that.signer
            ) {
              relay
                .auth((authEvt: EventTemplate) => that.signer!(authEvt))
                .then(() => relay.publish(event))
            } else {
              throw error
            }
          })
      })
    )
    this.dispatchEvent(new CustomEvent('eventPublished', { detail: event }))
    return result
  }

  private generateTimelineKey(urls: string[], filter: Filter) {
    const paramsStr = JSON.stringify({ urls: urls.sort(), filter })
    const encoder = new TextEncoder()
    const data = encoder.encode(paramsStr)
    const hashBuffer = sha256(data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  async subscribeTimeline(
    urls: string[],
    filter: Omit<Filter, 'since' | 'until'> & { limit: number }, // filter with limit,
    {
      onEvents,
      onNew
    }: {
      onEvents: (events: NEvent[], eosed: boolean) => void
      onNew: (evt: NEvent) => void
    },
    {
      startLogin,
      needSort = true
    }: {
      startLogin?: () => void
      needSort?: boolean
    } = {}
  ) {
    const relays = Array.from(new Set(urls))
    const key = this.generateTimelineKey(relays, filter)
    const timeline = this.timelines[key]
    let cachedEvents: NEvent[] = []
    let since: number | undefined
    if (timeline && timeline.refs.length && needSort) {
      cachedEvents = (
        await Promise.all(
          timeline.refs.slice(0, filter.limit).map(([id]) => this.eventCache.get(id))
        )
      ).filter(Boolean) as NEvent[]
      if (cachedEvents.length) {
        onEvents([...cachedEvents], false)
        since = cachedEvents[0].created_at + 1
      }
    }

    if (!timeline && needSort) {
      this.timelines[key] = { refs: [], filter, urls: relays }
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    const _knownIds = new Set<string>()
    let events: NEvent[] = []
    let startedCount = 0
    let eosedCount = 0
    let eosed = false
    const subPromises = relays.map(async (url) => {
      const relay = await this.pool.ensureRelay(url)
      let hasAuthed = false

      return startSub()

      function startSub() {
        startedCount++
        return relay.subscribe([since ? { ...filter, since } : filter], {
          receivedEvent: (relay, id) => {
            that.trackEventSeenOn(id, relay)
          },
          alreadyHaveEvent: (id: string) => {
            const have = _knownIds.has(id)
            if (have) {
              return true
            }
            _knownIds.add(id)
            return false
          },
          onevent: (evt: NEvent) => {
            that.eventDataLoader.prime(evt.id, Promise.resolve(evt))
            // not eosed yet, push to events
            if (eosedCount < startedCount) {
              return events.push(evt)
            }
            // eosed, (algo relay feeds) no need to sort and cache
            if (!needSort) {
              return onNew(evt)
            }

            const timeline = that.timelines[key]
            if (!timeline || !timeline.refs.length) {
              return onNew(evt)
            }
            // the event is newer than the first ref, insert it to the front
            if (evt.created_at > timeline.refs[0][1]) {
              onNew(evt)
              return timeline.refs.unshift([evt.id, evt.created_at])
            }

            let idx = 0
            for (const ref of timeline.refs) {
              if (evt.created_at > ref[1] || (evt.created_at === ref[1] && evt.id < ref[0])) {
                break
              }
              // the event is already in the cache
              if (evt.created_at === ref[1] && evt.id === ref[0]) {
                return
              }
              idx++
            }
            // the event is too old, ignore it
            if (idx >= timeline.refs.length) return

            // insert the event to the right position
            timeline.refs.splice(idx, 0, [evt.id, evt.created_at])
          },
          onclose: (reason: string) => {
            if (!reason.startsWith('auth-required:')) return
            if (hasAuthed) return

            if (that.signer) {
              relay
                .auth(async (authEvt: EventTemplate) => {
                  const evt = await that.signer!(authEvt)
                  if (!evt) {
                    throw new Error('sign event failed')
                  }
                  return evt as VerifiedEvent
                })
                .then(() => {
                  hasAuthed = true
                  if (!eosed) {
                    startSub()
                  }
                })
                .catch(() => {
                  // ignore
                })
            } else if (startLogin) {
              startLogin()
            }
          },
          oneose: () => {
            if (eosed) return
            eosedCount++
            eosed = eosedCount >= startedCount

            // (algo feeds) no need to sort and cache
            if (!needSort) {
              return onEvents([...events], eosed)
            }
            if (!eosed) {
              events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit)
              return onEvents([...events.concat(cachedEvents)], false)
            }

            events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit)
            const timeline = that.timelines[key]
            // no cache yet
            if (!timeline || !timeline.refs.length) {
              that.timelines[key] = {
                refs: events.map((evt) => [evt.id, evt.created_at]),
                filter,
                urls
              }
              return onEvents([...events], true)
            }

            const newEvents = events.filter((evt) => {
              const firstRef = timeline.refs[0]
              return (
                evt.created_at > firstRef[1] ||
                (evt.created_at === firstRef[1] && evt.id < firstRef[0])
              )
            })
            const newRefs = newEvents.map((evt) => [evt.id, evt.created_at] as TTimelineRef)

            if (newRefs.length >= filter.limit) {
              // if new refs are more than limit, means old refs are too old, replace them
              timeline.refs = newRefs
              onEvents([...newEvents], true)
            } else {
              // merge new refs with old refs
              timeline.refs = newRefs.concat(timeline.refs)
              onEvents([...newEvents.concat(cachedEvents)], true)
            }
          },
          eoseTimeout: 10000 // 10s
        })
      }
    })

    return {
      timelineKey: key,
      closer: () => {
        onEvents = () => {}
        onNew = () => {}
        subPromises.forEach((subPromise) => {
          subPromise
            .then((sub) => {
              sub.close()
            })
            .catch((err) => {
              console.error(err)
            })
        })
      }
    }
  }

  subscribe(urls: string[], filter: Filter | Filter[], params: SubscribeManyParams) {
    const relays = Array.from(new Set(urls))
    const filters = Array.isArray(filter) ? filter : [filter]
    return this.pool.subscribeMany(relays, filters, params)
  }

  private async query(urls: string[], filter: Filter | Filter[], onevent?: (evt: NEvent) => void) {
    const relays = Array.from(new Set(urls))
    const filters = Array.isArray(filter) ? filter : [filter]
    const _knownIds = new Set<string>()
    const events: NEvent[] = []
    await Promise.allSettled(
      relays.map(async (url) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this
        const relay = await this.pool.ensureRelay(url)
        let hasAuthed = false

        return new Promise<void>((resolve, reject) => {
          const startQuery = () => {
            relay.subscribe(filters, {
              receivedEvent(relay, id) {
                that.trackEventSeenOn(id, relay)
              },
              onclose(reason) {
                if (!reason.startsWith('auth-required:') || hasAuthed) {
                  resolve()
                  return
                }

                if (that.signer) {
                  relay
                    .auth((authEvt: EventTemplate) => that.signer!(authEvt))
                    .then(() => {
                      hasAuthed = true
                      startQuery()
                    })
                    .catch(reject)
                }
              },
              oneose() {
                resolve()
              },
              onevent(evt) {
                if (_knownIds.has(evt.id)) return
                _knownIds.add(evt.id)
                events.push(evt)
                onevent?.(evt)
              }
            })
          }
          startQuery()
        })
      })
    )
    return events
  }

  async loadMoreTimeline(key: string, until: number, limit: number) {
    const timeline = this.timelines[key]
    if (!timeline) return []

    const { filter, urls, refs } = timeline
    const startIdx = refs.findIndex(([, createdAt]) => createdAt < until)
    const cachedEvents =
      startIdx >= 0
        ? ((
            await Promise.all(
              refs.slice(startIdx, startIdx + limit).map(([id]) => this.eventCache.get(id))
            )
          ).filter(Boolean) as NEvent[])
        : []
    if (cachedEvents.length > 0) {
      return cachedEvents
    }

    let events = await this.query(urls, { ...filter, until: until, limit: limit })
    events.forEach((evt) => {
      this.eventDataLoader.prime(evt.id, Promise.resolve(evt))
    })
    events = events.sort((a, b) => b.created_at - a.created_at).slice(0, limit)
    timeline.refs.push(...events.map((evt) => [evt.id, evt.created_at] as TTimelineRef))
    return events
  }

  async fetchEvents(
    urls: string[],
    filter: Filter | Filter[],
    {
      onevent,
      cache = false
    }: {
      onevent?: (evt: NEvent) => void
      cache?: boolean
    } = {}
  ) {
    const relays = Array.from(new Set(urls))
    const events = await this.query(
      relays.length > 0 ? relays : this.currentRelayUrls.concat(BIG_RELAY_URLS),
      filter,
      onevent
    )
    if (cache) {
      events.forEach((evt) => {
        this.eventDataLoader.prime(evt.id, Promise.resolve(evt))
      })
    }
    return events
  }

  async fetchEvent(id: string): Promise<NEvent | undefined> {
    if (!/^[0-9a-f]{64}$/.test(id)) {
      let eventId: string | undefined
      const { type, data } = nip19.decode(id)
      switch (type) {
        case 'note':
          eventId = data
          break
        case 'nevent':
          eventId = data.id
          break
      }
      if (eventId) {
        const cache = await this.eventCache.get(eventId)
        if (cache) {
          return cache
        }
      }
    }
    return this.eventDataLoader.load(id)
  }

  addEventToCache(event: NEvent) {
    this.eventDataLoader.prime(event.id, Promise.resolve(event))
  }

  async fetchProfileEvent(id: string, skipCache: boolean = false): Promise<NEvent | undefined> {
    let pubkey: string | undefined
    let relays: string[] = []
    if (/^[0-9a-f]{64}$/.test(id)) {
      pubkey = id
    } else {
      const { data, type } = nip19.decode(id)
      switch (type) {
        case 'npub':
          pubkey = data
          break
        case 'nprofile':
          pubkey = data.pubkey
          if (data.relays) relays = data.relays
          break
      }
    }

    if (!pubkey) {
      throw new Error('Invalid id')
    }
    if (!skipCache) {
      const localProfile = await indexedDb.getReplaceableEvent(pubkey, kinds.Metadata)
      if (localProfile) {
        this.addUsernameToIndex(localProfile)
        return localProfile
      }
    }
    const profileFromBigRelays = await this.fetchProfileEventFromBigRelaysDataloader.load(pubkey)
    if (profileFromBigRelays) {
      this.addUsernameToIndex(profileFromBigRelays)
      await indexedDb.putReplaceableEvent(profileFromBigRelays)
      return profileFromBigRelays
    }

    if (!relays.length) {
      return undefined
    }

    const profileEvent = await this.tryHarderToFetchEvent(
      relays,
      {
        authors: [pubkey],
        kinds: [kinds.Metadata],
        limit: 1
      },
      true
    )

    if (profileEvent) {
      this.addUsernameToIndex(profileEvent)
      indexedDb.putReplaceableEvent(profileEvent)
    }

    return profileEvent
  }

  async fetchProfile(id: string, skipCache: boolean = false): Promise<TProfile | undefined> {
    let profileEvent: NEvent | undefined
    if (skipCache) {
      profileEvent = await this.fetchProfileEvent(id, skipCache)
    } else {
      profileEvent = await this.fetchProfileEvent(id)
    }
    if (profileEvent) {
      return getProfileFromProfileEvent(profileEvent)
    }

    try {
      const pubkey = userIdToPubkey(id)
      return { pubkey, username: formatPubkey(pubkey) }
    } catch {
      return undefined
    }
  }

  async fetchProfiles(relayUrls: string[], filter: Filter): Promise<TProfile[]> {
    const events = await this.query(relayUrls, {
      ...filter,
      kinds: [kinds.Metadata]
    })

    const profileEvents = events.sort((a, b) => b.created_at - a.created_at)
    await Promise.all(profileEvents.map((profile) => this.addUsernameToIndex(profile)))
    return profileEvents.map((profileEvent) => getProfileFromProfileEvent(profileEvent))
  }

  async fetchRelayListEvent(pubkey: string) {
    return this.relayListEventDataLoader.load(pubkey)
  }

  async fetchRelayList(pubkey: string): Promise<TRelayList> {
    const event = await this.relayListEventDataLoader.load(pubkey)
    if (!event) {
      return {
        write: BIG_RELAY_URLS,
        read: BIG_RELAY_URLS,
        originalRelays: []
      }
    }
    return getRelayListFromRelayListEvent(event)
  }

  async fetchFollowListEvent(pubkey: string, storeToIndexedDb = false) {
    const event = await this.followListCache.fetch(pubkey)
    if (storeToIndexedDb && event) {
      await indexedDb.putReplaceableEvent(event)
    }
    return event
  }

  async fetchFollowings(pubkey: string, storeToIndexedDb = false) {
    const followListEvent = await this.fetchFollowListEvent(pubkey, storeToIndexedDb)
    return followListEvent ? extractPubkeysFromEventTags(followListEvent.tags) : []
  }

  updateFollowListCache(event: NEvent) {
    this.followListCache.set(event.pubkey, Promise.resolve(event))
  }

  updateRelayListCache(event: NEvent) {
    this.relayListEventDataLoader.clear(event.pubkey)
    this.relayListEventDataLoader.prime(event.pubkey, Promise.resolve(event))
  }

  async calculateOptimalReadRelays(pubkey: string) {
    const followings = await this.fetchFollowings(pubkey, true)
    const [selfRelayListEvent, ...relayListEvents] = await this.relayListEventDataLoader.loadMany([
      pubkey,
      ...followings
    ])
    const selfReadRelays =
      selfRelayListEvent && !(selfRelayListEvent instanceof Error)
        ? getRelayListFromRelayListEvent(selfRelayListEvent).read
        : []
    const pubkeyRelayListMap = new Map<string, string[]>()
    relayListEvents.forEach((evt) => {
      if (evt && !(evt instanceof Error)) {
        pubkeyRelayListMap.set(evt.pubkey, getRelayListFromRelayListEvent(evt).write)
      }
    })
    let uncoveredPubkeys = [...followings]
    const readRelays: { url: string; pubkeys: string[] }[] = []
    while (uncoveredPubkeys.length) {
      const relayMap = new Map<string, string[]>()
      uncoveredPubkeys.forEach((pubkey) => {
        const relays = pubkeyRelayListMap.get(pubkey)
        if (relays) {
          relays.forEach((url) => {
            relayMap.set(url, (relayMap.get(url) || []).concat(pubkey))
          })
        }
      })
      let maxCoveredRelay: { url: string; pubkeys: string[] } | undefined
      for (const [url, pubkeys] of relayMap.entries()) {
        if (!maxCoveredRelay) {
          maxCoveredRelay = { url, pubkeys }
        } else if (pubkeys.length > maxCoveredRelay.pubkeys.length) {
          maxCoveredRelay = { url, pubkeys }
        } else if (
          pubkeys.length === maxCoveredRelay.pubkeys.length &&
          selfReadRelays.includes(url)
        ) {
          maxCoveredRelay = { url, pubkeys }
        }
      }
      if (!maxCoveredRelay) break
      readRelays.push(maxCoveredRelay)
      uncoveredPubkeys = uncoveredPubkeys.filter(
        (pubkey) => !maxCoveredRelay!.pubkeys.includes(pubkey)
      )
    }
    return readRelays
  }

  async searchProfilesFromIndex(query: string, limit: number = 100) {
    const result = await this.userIndex.searchAsync(query, { limit })
    return Promise.all(result.map((pubkey) => this.fetchProfile(pubkey as string))).then(
      (profiles) => profiles.filter(Boolean) as TProfile[]
    )
  }

  async initUserIndexFromFollowings(pubkey: string, signal: AbortSignal) {
    const followings = await this.fetchFollowings(pubkey, true)
    for (let i = 0; i * 20 < followings.length; i++) {
      if (signal.aborted) return
      await Promise.all(
        followings.slice(i * 20, (i + 1) * 20).map((pubkey) => this.fetchProfileEvent(pubkey))
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  getSeenEventRelays(eventId: string) {
    return Array.from(this.pool.seenOn.get(eventId)?.values() || [])
  }

  getSeenEventRelayUrls(eventId: string) {
    return this.getSeenEventRelays(eventId).map((relay) => relay.url)
  }

  getEventHints(eventId: string) {
    return this.getSeenEventRelayUrls(eventId).filter((url) => !isLocalNetworkUrl(url))
  }

  getEventHint(eventId: string) {
    return this.getSeenEventRelayUrls(eventId).find((url) => !isLocalNetworkUrl(url)) ?? ''
  }

  trackEventSeenOn(eventId: string, relay: AbstractRelay) {
    let set = this.pool.seenOn.get(eventId)
    if (!set) {
      set = new Set()
      this.pool.seenOn.set(eventId, set)
    }
    set.add(relay)
  }

  private async fetchEventById(relayUrls: string[], id: string): Promise<NEvent | undefined> {
    const event = await this.fetchEventFromBigRelaysDataloader.load(id)
    if (event) {
      return event
    }

    return this.tryHarderToFetchEvent(relayUrls, { ids: [id], limit: 1 }, true)
  }

  private async _fetchEvent(id: string): Promise<NEvent | undefined> {
    let filter: Filter | undefined
    let relays: string[] = []
    if (/^[0-9a-f]{64}$/.test(id)) {
      filter = { ids: [id] }
    } else {
      const { type, data } = nip19.decode(id)
      switch (type) {
        case 'note':
          filter = { ids: [data] }
          break
        case 'nevent':
          filter = { ids: [data.id] }
          if (data.relays) relays = data.relays
          break
        case 'naddr':
          filter = {
            authors: [data.pubkey],
            kinds: [data.kind],
            limit: 1
          }
          if (data.identifier) {
            filter['#d'] = [data.identifier]
          }
          if (data.relays) relays = data.relays
      }
    }
    if (!filter) {
      throw new Error('Invalid id')
    }

    let event: NEvent | undefined
    if (filter.ids) {
      event = await this.fetchEventById(relays, filter.ids[0])
    } else {
      event = await this.tryHarderToFetchEvent(relays, filter)
    }

    if (event && event.id !== id) {
      this.eventDataLoader.prime(event.id, Promise.resolve(event))
    }

    return event
  }

  private async addUsernameToIndex(profileEvent: NEvent) {
    try {
      const profileObj = JSON.parse(profileEvent.content)
      const text = [
        profileObj.display_name?.trim() ?? '',
        profileObj.name?.trim() ?? '',
        profileObj.nip05
          ?.split('@')
          .map((s: string) => s.trim())
          .join(' ') ?? ''
      ].join(' ')
      if (!text) return

      await this.userIndex.addAsync(profileEvent.pubkey, text)
    } catch {
      return
    }
  }

  private async tryHarderToFetchEvent(
    relayUrls: string[],
    filter: Filter,
    alreadyFetchedFromBigRelays = false
  ) {
    if (!relayUrls.length && filter.authors?.length) {
      const relayList = await this.fetchRelayList(filter.authors[0])
      relayUrls = alreadyFetchedFromBigRelays
        ? relayList.write.filter((url) => !BIG_RELAY_URLS.includes(url)).slice(0, 4)
        : relayList.write.slice(0, 4)
    } else if (!relayUrls.length && !alreadyFetchedFromBigRelays) {
      relayUrls = BIG_RELAY_URLS
    }
    if (!relayUrls.length) return

    const events = await this.query(relayUrls, filter)
    return events.sort((a, b) => b.created_at - a.created_at)[0]
  }

  private async fetchEventsFromBigRelays(ids: readonly string[]) {
    const events = await this.query(BIG_RELAY_URLS, {
      ids: Array.from(new Set(ids)),
      limit: ids.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      eventsMap.set(event.id, event)
    }

    return ids.map((id) => eventsMap.get(id))
  }

  private async profileEventBatchLoadFn(pubkeys: readonly string[]) {
    const events = await this.query(BIG_RELAY_URLS, {
      authors: Array.from(new Set(pubkeys)),
      kinds: [kinds.Metadata],
      limit: pubkeys.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      const pubkey = event.pubkey
      const existing = eventsMap.get(pubkey)
      if (!existing || existing.created_at < event.created_at) {
        eventsMap.set(pubkey, event)
      }
    }
    const profileEvents = pubkeys.map((pubkey) => {
      return eventsMap.get(pubkey)
    })

    profileEvents.forEach(
      (profileEvent) => profileEvent && indexedDb.putReplaceableEvent(profileEvent)
    )
    return profileEvents
  }

  private async relayListEventBatchLoadFn(pubkeys: readonly string[]) {
    const relayEvents = await Promise.all(
      pubkeys.map((pubkey) => indexedDb.getReplaceableEvent(pubkey, kinds.RelayList))
    )
    const nonExistingPubkeys = pubkeys.filter((_, i) => !relayEvents[i])
    if (nonExistingPubkeys.length) {
      const events = await this.query(BIG_RELAY_URLS, {
        authors: pubkeys as string[],
        kinds: [kinds.RelayList],
        limit: pubkeys.length
      })
      const eventsMap = new Map<string, NEvent>()
      for (const event of events) {
        const pubkey = event.pubkey
        const existing = eventsMap.get(pubkey)
        if (!existing || existing.created_at < event.created_at) {
          eventsMap.set(pubkey, event)
        }
      }
      Array.from(eventsMap.values()).forEach((evt) => indexedDb.putReplaceableEvent(evt))
      nonExistingPubkeys.forEach((pubkey) => {
        const event = eventsMap.get(pubkey)
        if (event) {
          const index = pubkeys.indexOf(pubkey)
          relayEvents[index] = event
        }
      })
    }

    return relayEvents
  }

  private async _fetchFollowListEvent(pubkey: string) {
    const storedFollowListEvent = await indexedDb.getReplaceableEvent(pubkey, kinds.Contacts)
    if (storedFollowListEvent) {
      return storedFollowListEvent
    }

    const relayList = await this.fetchRelayList(pubkey)
    const followListEvents = await this.query(relayList.write.concat(BIG_RELAY_URLS), {
      authors: [pubkey],
      kinds: [kinds.Contacts]
    })

    return followListEvents.sort((a, b) => b.created_at - a.created_at)[0]
  }
}

const instance = ClientService.getInstance()
export default instance
