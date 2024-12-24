import { BIG_RELAY_URLS } from '@/constants'
import { formatPubkey } from '@/lib/pubkey'
import { tagNameEquals } from '@/lib/tag'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import { TDraftEvent, TProfile, TRelayInfo, TRelayList } from '@/types'
import { sha256 } from '@noble/hashes/sha2'
import DataLoader from 'dataloader'
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

type TTimelineRef = [string, number]

class ClientService extends EventTarget {
  static instance: ClientService

  private defaultRelayUrls: string[] = BIG_RELAY_URLS
  private pool = new SimplePool()

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
  private fetchEventFromDefaultRelaysDataloader = new DataLoader<string, NEvent | undefined>(
    this.eventBatchLoadFn.bind(this),
    { cache: false }
  )
  private profileCache = new LRUCache<string, Promise<TProfile>>({ max: 10000 })
  private profileDataloader = new DataLoader<string, TProfile>(
    (ids) => Promise.all(ids.map((id) => this._fetchProfile(id))),
    { cacheMap: this.profileCache }
  )
  private fetchProfileFromDefaultRelaysDataloader = new DataLoader<string, TProfile | undefined>(
    this.profileBatchLoadFn.bind(this),
    { cache: false }
  )
  private relayListDataLoader = new DataLoader<string, TRelayList>(
    this.relayListBatchLoadFn.bind(this),
    {
      cacheMap: new LRUCache<string, Promise<TRelayList>>({ max: 10000 })
    }
  )
  private relayInfoDataLoader = new DataLoader<string, TRelayInfo | undefined>(async (urls) => {
    return await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url.replace('ws://', 'http://').replace('wss://', 'https://'), {
            headers: { Accept: 'application/nostr+json' }
          })
          return res.json() as TRelayInfo
        } catch {
          return undefined
        }
      })
    )
  })
  private followListCache = new LRUCache<string, Promise<NEvent | undefined>>({
    max: 10000,
    fetchMethod: this._fetchFollowListEvent.bind(this)
  })

  constructor() {
    super()
  }

  public static getInstance(): ClientService {
    if (!ClientService.instance) {
      ClientService.instance = new ClientService()
    }
    return ClientService.instance
  }

  listConnectionStatus() {
    return this.pool.listConnectionStatus()
  }

  setCurrentRelayUrls(urls: string[]) {
    this.defaultRelayUrls = Array.from(new Set(urls.concat(BIG_RELAY_URLS)))
  }

  getDefaultRelayUrls() {
    return this.defaultRelayUrls
  }

  async publishEvent(relayUrls: string[], event: NEvent) {
    const result = await Promise.any(this.pool.publish(relayUrls, event))
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
      signer,
      needSort = true
    }: {
      signer?: (evt: TDraftEvent) => Promise<NEvent | null>
      needSort?: boolean
    } = {}
  ) {
    const key = this.generateTimelineKey(urls, filter)
    const timeline = this.timelines[key]
    let cachedEvents: NEvent[] = []
    let since: number | undefined
    if (timeline && timeline.refs.length) {
      cachedEvents = (
        await Promise.all(
          timeline.refs.slice(0, filter.limit).map(([id]) => this.eventCache.get(id))
        )
      ).filter(Boolean) as NEvent[]
      if (cachedEvents.length) {
        onEvents(cachedEvents, false)
        since = cachedEvents[0].created_at + 1
      }
    }

    if (!timeline && needSort) {
      this.timelines[key] = { refs: [], filter, urls }
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    const _knownIds = new Set<string>()
    let events: NEvent[] = []
    let startedCount = 0
    let eosedCount = 0
    let eosed = false
    const subPromises = urls.map(async (url) => {
      const relay = await this.pool.ensureRelay(url)
      let hasAuthed = false

      return startSub()

      function startSub() {
        startedCount++
        return relay.subscribe([since ? { ...filter, since } : filter], {
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
            if (reason.startsWith('auth-required:')) {
              if (!hasAuthed && signer) {
                relay
                  .auth(async (authEvt: EventTemplate) => {
                    const evt = await signer(authEvt)
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
              }
            }
          },
          oneose: () => {
            if (eosed) return
            eosedCount++
            eosed = eosedCount >= startedCount

            // (algo feeds) no need to sort and cache
            if (!needSort) {
              return onEvents(events, eosed)
            }
            if (!eosed) {
              events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit)
              return onEvents(events.concat(cachedEvents), false)
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
              return onEvents(events, true)
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
              onEvents(newEvents, true)
            } else {
              // merge new refs with old refs
              timeline.refs = newRefs.concat(timeline.refs)
              onEvents(newEvents.concat(cachedEvents), true)
            }
          }
        })
      }
    })

    return {
      timelineKey: key,
      closer: () => {
        onEvents = () => {}
        onNew = () => {}
        subPromises.forEach((subPromise) => {
          subPromise.then((sub) => {
            sub.close()
          })
        })
      }
    }
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

    let events = await this.pool.querySync(urls, { ...filter, until: until, limit: limit })
    events.forEach((evt) => {
      this.eventDataLoader.prime(evt.id, Promise.resolve(evt))
    })
    events = events.sort((a, b) => b.created_at - a.created_at).slice(0, limit)
    timeline.refs.push(...events.map((evt) => [evt.id, evt.created_at] as TTimelineRef))
    return events
  }

  async fetchEvents(relayUrls: string[], filter: Filter, cache = false) {
    const events = await this.pool.querySync(
      relayUrls.length > 0 ? relayUrls : this.defaultRelayUrls,
      filter
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

  async fetchProfile(id: string): Promise<TProfile | undefined> {
    if (!/^[0-9a-f]{64}$/.test(id)) {
      let pubkey: string | undefined
      const { data, type } = nip19.decode(id)
      switch (type) {
        case 'npub':
          pubkey = data
          break
        case 'nprofile':
          pubkey = data.pubkey
          break
      }

      if (!pubkey) {
        throw new Error('Invalid id')
      }

      const cache = await this.profileCache.get(pubkey)
      if (cache) {
        return cache
      }
    }

    return this.profileDataloader.load(id)
  }

  async fetchProfiles(relayUrls: string[], filter: Filter): Promise<TProfile[]> {
    const events = await this.pool.querySync(relayUrls, {
      ...filter,
      kinds: [kinds.Metadata]
    })

    const profiles = events
      .sort((a, b) => b.created_at - a.created_at)
      .map((event) => this.parseProfileFromEvent(event))
    profiles.forEach((profile) => this.profileDataloader.prime(profile.pubkey, profile))
    return profiles
  }

  async fetchRelayList(pubkey: string): Promise<TRelayList> {
    return this.relayListDataLoader.load(pubkey)
  }

  async fetchFollowListEvent(pubkey: string) {
    return this.followListCache.fetch(pubkey)
  }

  updateFollowListCache(pubkey: string, event: NEvent) {
    this.followListCache.set(pubkey, Promise.resolve(event))
  }

  async fetchRelayInfos(urls: string[]) {
    const infos = await this.relayInfoDataLoader.loadMany(urls)
    return infos.map((info) => (info ? (info instanceof Error ? undefined : info) : undefined))
  }

  private async fetchEventById(relayUrls: string[], id: string): Promise<NEvent | undefined> {
    const event = await this.fetchEventFromDefaultRelaysDataloader.load(id)
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

  private async _fetchProfile(id: string): Promise<TProfile> {
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

    const profileFromDefaultRelays = await this.fetchProfileFromDefaultRelaysDataloader.load(pubkey)
    if (profileFromDefaultRelays) {
      return profileFromDefaultRelays
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
    const profile = profileEvent
      ? this.parseProfileFromEvent(profileEvent)
      : { pubkey, username: formatPubkey(pubkey) }

    if (pubkey !== id) {
      this.profileDataloader.prime(pubkey, Promise.resolve(profile))
    }

    return profile
  }

  private async tryHarderToFetchEvent(
    relayUrls: string[],
    filter: Filter,
    alreadyFetchedFromDefaultRelays = false
  ) {
    if (!relayUrls.length && filter.authors?.length) {
      const relayList = await this.fetchRelayList(filter.authors[0])
      relayUrls = alreadyFetchedFromDefaultRelays
        ? relayList.write.filter((url) => !this.defaultRelayUrls.includes(url)).slice(0, 4)
        : relayList.write.slice(0, 4)
    } else if (!relayUrls.length && !alreadyFetchedFromDefaultRelays) {
      relayUrls = this.defaultRelayUrls
    }
    if (!relayUrls.length) return

    const events = await this.pool.querySync(relayUrls, filter)
    return events.sort((a, b) => b.created_at - a.created_at)[0]
  }

  private async eventBatchLoadFn(ids: readonly string[]) {
    const events = await this.pool.querySync(this.defaultRelayUrls, {
      ids: Array.from(new Set(ids)),
      limit: ids.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      eventsMap.set(event.id, event)
    }

    return ids.map((id) => eventsMap.get(id))
  }

  private async profileBatchLoadFn(pubkeys: readonly string[]) {
    const events = await this.pool.querySync(this.defaultRelayUrls, {
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

    return pubkeys.map((pubkey) => {
      const event = eventsMap.get(pubkey)
      return event ? this.parseProfileFromEvent(event) : undefined
    })
  }

  private async relayListBatchLoadFn(pubkeys: readonly string[]) {
    const events = await this.pool.querySync(this.defaultRelayUrls, {
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

    return pubkeys.map((pubkey) => {
      const event = eventsMap.get(pubkey)
      const relayList = { write: [], read: [] } as TRelayList
      if (!event) return relayList

      event.tags.filter(tagNameEquals('r')).forEach(([, url, type]) => {
        if (!url || !isWebsocketUrl(url)) return

        const normalizedUrl = normalizeUrl(url)
        switch (type) {
          case 'w':
            relayList.write.push(normalizedUrl)
            break
          case 'r':
            relayList.read.push(normalizedUrl)
            break
          default:
            relayList.write.push(normalizedUrl)
            relayList.read.push(normalizedUrl)
        }
      })
      return {
        write: relayList.write.slice(0, 10),
        read: relayList.read.slice(0, 10)
      }
    })
  }

  private async _fetchFollowListEvent(pubkey: string) {
    const relayList = await this.fetchRelayList(pubkey)
    const followListEvents = await this.pool.querySync(
      relayList.write.concat(this.defaultRelayUrls),
      {
        authors: [pubkey],
        kinds: [kinds.Contacts]
      }
    )

    return followListEvents.sort((a, b) => b.created_at - a.created_at)[0]
  }

  private parseProfileFromEvent(event: NEvent): TProfile {
    try {
      const profileObj = JSON.parse(event.content)
      return {
        pubkey: event.pubkey,
        banner: profileObj.banner,
        avatar: profileObj.picture,
        username:
          profileObj.display_name?.trim() ||
          profileObj.name?.trim() ||
          profileObj.nip05?.split('@')[0]?.trim() ||
          formatPubkey(event.pubkey),
        nip05: profileObj.nip05,
        about: profileObj.about,
        created_at: event.created_at
      }
    } catch (err) {
      console.error(err)
      return {
        pubkey: event.pubkey,
        username: formatPubkey(event.pubkey)
      }
    }
  }
}

const instance = ClientService.getInstance()

export default instance