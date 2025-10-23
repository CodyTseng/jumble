import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import {
  compareEvents,
  getReplaceableCoordinate,
  getReplaceableCoordinateFromEvent,
  isReplaceableEvent
} from '@/lib/event'
import { getProfileFromEvent, getRelayListFromEvent } from '@/lib/event-metadata'
import { formatPubkey, isValidPubkey, pubkeyToNpub, userIdToPubkey } from '@/lib/pubkey'
import { getPubkeysFromPTags, getServersFromServerTags, tagNameEquals } from '@/lib/tag'
import { isLocalNetworkUrl, isWebsocketUrl, normalizeUrl } from '@/lib/url'
import { isSafari } from '@/lib/utils'
import { ISigner, TProfile, TPublishOptions, TRelayList, TSubRequestFilter } from '@/types'
import { sha256 } from '@noble/hashes/sha2'
import DataLoader from 'dataloader'
import dayjs from 'dayjs'
import FlexSearch from 'flexsearch'
import { LRUCache } from 'lru-cache'
import {
  EventTemplate,
  Filter,
  kinds,
  matchFilters,
  Event as NEvent,
  nip19,
  Relay,
  SimplePool,
  validateEvent,
  VerifiedEvent
} from 'nostr-tools'
import { AbstractRelay } from 'nostr-tools/abstract-relay'
import indexedDb from './indexed-db.service'

type TTimelineRef = [string, number]

class ClientService extends EventTarget {
  static instance: ClientService

  signer?: ISigner
  pubkey?: string
  private pool: SimplePool

  private timelines: Record<
    string,
    | {
        refs: TTimelineRef[]
        filter: TSubRequestFilter
        urls: string[]
      }
    | string[]
    | undefined
  > = {}
  private replaceableEventCacheMap = new Map<string, NEvent>()
  private eventCacheMap = new Map<string, Promise<NEvent | undefined>>()
  private eventDataLoader = new DataLoader<string, NEvent | undefined>(
    (ids) => Promise.all(ids.map((id) => this._fetchEvent(id))),
    { cacheMap: this.eventCacheMap }
  )
  private fetchEventFromBigRelaysDataloader = new DataLoader<string, NEvent | undefined>(
    this.fetchEventsFromBigRelays.bind(this),
    { cache: false, batchScheduleFn: (callback) => setTimeout(callback, 50) }
  )
  private trendingNotesCache: NEvent[] | null = null

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

  async determineTargetRelays(
    event: NEvent,
    { specifiedRelayUrls, additionalRelayUrls }: TPublishOptions = {}
  ) {
    if (event.kind === kinds.Report) {
      const targetEventId = event.tags.find(tagNameEquals('e'))?.[1]
      if (targetEventId) {
        return this.getSeenEventRelayUrls(targetEventId)
      }
    }

    let relays: string[]
    if (specifiedRelayUrls?.length) {
      relays = specifiedRelayUrls
    } else {
      const _additionalRelayUrls: string[] = additionalRelayUrls ?? []
      if (!specifiedRelayUrls?.length && ![kinds.Contacts, kinds.Mutelist].includes(event.kind)) {
        const mentions: string[] = []
        event.tags.forEach(([tagName, tagValue]) => {
          if (
            ['p', 'P'].includes(tagName) &&
            !!tagValue &&
            isValidPubkey(tagValue) &&
            !mentions.includes(tagValue)
          ) {
            mentions.push(tagValue)
          }
        })
        if (mentions.length > 0) {
          const relayLists = await this.fetchRelayLists(mentions)
          relayLists.forEach((relayList) => {
            _additionalRelayUrls.push(...relayList.read.slice(0, 4))
          })
        }
      }
      if (
        [
          kinds.RelayList,
          kinds.Contacts,
          ExtendedKind.FAVORITE_RELAYS,
          ExtendedKind.BLOSSOM_SERVER_LIST,
          ExtendedKind.RELAY_REVIEW
        ].includes(event.kind)
      ) {
        _additionalRelayUrls.push(...BIG_RELAY_URLS)
      }

      const relayList = await this.fetchRelayList(event.pubkey)
      relays = (relayList?.write.slice(0, 10) ?? []).concat(
        Array.from(new Set(_additionalRelayUrls)) ?? []
      )
    }

    if (!relays.length) {
      relays.push(...BIG_RELAY_URLS)
    }

    return relays
  }

  async publishEvent(relayUrls: string[], event: NEvent) {
    const uniqueRelayUrls = Array.from(new Set(relayUrls))
    await new Promise<void>((resolve, reject) => {
      let successCount = 0
      let finishedCount = 0
      const errors: { url: string; error: any }[] = []
      Promise.allSettled(
        uniqueRelayUrls.map(async (url) => {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const that = this
          const relay = await this.pool.ensureRelay(url)
          relay.publishTimeout = 10_000 // 10s
          return relay
            .publish(event)
            .then(() => {
              this.trackEventSeenOn(event.id, relay)
              successCount++
            })
            .catch((error) => {
              if (
                error instanceof Error &&
                error.message.startsWith('auth-required') &&
                !!that.signer
              ) {
                return relay
                  .auth((authEvt: EventTemplate) => that.signer!.signEvent(authEvt))
                  .then(() => relay.publish(event))
              } else {
                errors.push({ url, error })
              }
            })
            .finally(() => {
              // If one third of the relays have accepted the event, consider it a success
              const isSuccess = successCount >= uniqueRelayUrls.length / 3
              if (isSuccess) {
                this.emitNewEvent(event)
                resolve()
              }
              if (++finishedCount >= uniqueRelayUrls.length) {
                reject(
                  new AggregateError(
                    errors.map(
                      ({ url, error }) =>
                        new Error(
                          `${url}: ${error instanceof Error ? error.message : String(error)}`
                        )
                    )
                  )
                )
              }
            })
        })
      )
    })
  }

  emitNewEvent(event: NEvent) {
    this.dispatchEvent(new CustomEvent('newEvent', { detail: event }))
  }

  async signHttpAuth(url: string, method: string, description = '') {
    if (!this.signer) {
      throw new Error('Please login first to sign the event')
    }
    const event = await this.signer?.signEvent({
      content: description,
      kind: kinds.HTTPAuth,
      created_at: dayjs().unix(),
      tags: [
        ['u', url],
        ['method', method]
      ]
    })
    return 'Nostr ' + btoa(JSON.stringify(event))
  }

  /** =========== Timeline =========== */

  private generateTimelineKey(urls: string[], filter: Filter) {
    const stableFilter: any = {}
    Object.entries(filter)
      .sort()
      .forEach(([key, value]) => {
        if (Array.isArray(value)) {
          stableFilter[key] = [...value].sort()
        }
        stableFilter[key] = value
      })
    const paramsStr = JSON.stringify({
      urls: [...urls].sort(),
      filter: stableFilter
    })
    const encoder = new TextEncoder()
    const data = encoder.encode(paramsStr)
    const hashBuffer = sha256(data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  private generateMultipleTimelinesKey(subRequests: { urls: string[]; filter: Filter }[]) {
    const keys = subRequests.map(({ urls, filter }) => this.generateTimelineKey(urls, filter))
    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(keys.sort()))
    const hashBuffer = sha256(data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  async subscribeTimeline(
    subRequests: { urls: string[]; filter: TSubRequestFilter }[],
    {
      onEvents,
      onNew,
      onClose
    }: {
      onEvents: (events: NEvent[], eosed: boolean) => void
      onNew: (evt: NEvent) => void
      onClose?: (url: string, reason: string) => void
    },
    {
      startLogin,
      needSort = true
    }: {
      startLogin?: () => void
      needSort?: boolean
    } = {}
  ) {
    const newEventIdSet = new Set<string>()
    const requestCount = subRequests.length
    const threshold = Math.floor(requestCount / 2)
    let eventIdSet = new Set<string>()
    let events: NEvent[] = []
    let eosedCount = 0

    const subs = await Promise.all(
      subRequests.map(({ urls, filter }) => {
        return this._subscribeTimeline(
          urls,
          filter,
          {
            onEvents: (_events, _eosed) => {
              if (_eosed) {
                eosedCount++
              }

              _events.forEach((evt) => {
                if (eventIdSet.has(evt.id)) return
                eventIdSet.add(evt.id)
                events.push(evt)
              })
              events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit)
              eventIdSet = new Set(events.map((evt) => evt.id))

              if (eosedCount >= threshold) {
                onEvents(events, eosedCount >= requestCount)
              }
            },
            onNew: (evt) => {
              if (newEventIdSet.has(evt.id)) return
              newEventIdSet.add(evt.id)
              onNew(evt)
            },
            onClose
          },
          { startLogin, needSort }
        )
      })
    )

    const key = this.generateMultipleTimelinesKey(subRequests)
    this.timelines[key] = subs.map((sub) => sub.timelineKey)

    return {
      closer: () => {
        onEvents = () => {}
        onNew = () => {}
        subs.forEach((sub) => {
          sub.closer()
        })
      },
      timelineKey: key
    }
  }

  async loadMoreTimeline(key: string, until: number, limit: number) {
    const timeline = this.timelines[key]
    if (!timeline) return []

    if (!Array.isArray(timeline)) {
      return this._loadMoreTimeline(key, until, limit)
    }
    const timelines = await Promise.all(
      timeline.map((key) => this._loadMoreTimeline(key, until, limit))
    )

    const eventIdSet = new Set<string>()
    const events: NEvent[] = []
    timelines.forEach((timeline) => {
      timeline.forEach((evt) => {
        if (eventIdSet.has(evt.id)) return
        eventIdSet.add(evt.id)
        events.push(evt)
      })
    })
    return events.sort((a, b) => b.created_at - a.created_at).slice(0, limit)
  }

  subscribe(
    urls: string[],
    filter: Filter | Filter[],
    {
      onevent,
      oneose,
      onclose,
      startLogin,
      onAllClose
    }: {
      onevent?: (evt: NEvent) => void
      oneose?: (eosed: boolean) => void
      onclose?: (url: string, reason: string) => void
      startLogin?: () => void
      onAllClose?: (reasons: string[]) => void
    }
  ) {
    const relays = Array.from(new Set(urls))
    const filters = Array.isArray(filter) ? filter : [filter]

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    const _knownIds = new Set<string>()
    let startedCount = 0
    let eosedCount = 0
    let eosed = false
    let closedCount = 0
    const closeReasons: string[] = []
    const subPromises: Promise<{ close: () => void }>[] = []
    relays.forEach((url) => {
      let hasAuthed = false

      subPromises.push(startSub())

      async function startSub() {
        startedCount++
        const relay = await that.pool.ensureRelay(url, { connectionTimeout: 5000 }).catch(() => {
          return undefined
        })
        // cannot connect to relay
        if (!relay) {
          if (!eosed) {
            eosedCount++
            eosed = eosedCount >= startedCount
            oneose?.(eosed)
          }
          return {
            close: () => {}
          }
        }

        return relay.subscribe(filters, {
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
            onevent?.(evt)
          },
          oneose: () => {
            // make sure eosed is not called multiple times
            if (eosed) return

            eosedCount++
            eosed = eosedCount >= startedCount
            oneose?.(eosed)
          },
          onclose: (reason: string) => {
            // auth-required
            if (reason.startsWith('auth-required') && !hasAuthed) {
              // already logged in
              if (that.signer) {
                relay
                  .auth(async (authEvt: EventTemplate) => {
                    const evt = await that.signer!.signEvent(authEvt)
                    if (!evt) {
                      throw new Error('sign event failed')
                    }
                    return evt as VerifiedEvent
                  })
                  .then(() => {
                    hasAuthed = true
                    if (!eosed) {
                      subPromises.push(startSub())
                    }
                  })
                  .catch(() => {
                    // ignore
                  })
                return
              }

              // open login dialog
              if (startLogin) {
                startLogin()
                return
              }
            }

            // close the subscription
            closedCount++
            closeReasons.push(reason)
            onclose?.(url, reason)
            if (closedCount >= startedCount) {
              onAllClose?.(closeReasons)
            }
            return
          },
          eoseTimeout: 10_000 // 10s
        })
      }
    })

    const handleNewEventFromInternal = (data: Event) => {
      const customEvent = data as CustomEvent<NEvent>
      const evt = customEvent.detail
      if (!matchFilters(filters, evt)) return

      const id = evt.id
      const have = _knownIds.has(id)
      if (have) return

      _knownIds.add(id)
      onevent?.(evt)
    }

    this.addEventListener('newEvent', handleNewEventFromInternal)

    return {
      close: () => {
        this.removeEventListener('newEvent', handleNewEventFromInternal)
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

  private async _subscribeTimeline(
    urls: string[],
    filter: TSubRequestFilter, // filter with limit,
    {
      onEvents,
      onNew,
      onClose
    }: {
      onEvents: (events: NEvent[], eosed: boolean) => void
      onNew: (evt: NEvent) => void
      onClose?: (url: string, reason: string) => void
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
    if (timeline && !Array.isArray(timeline) && timeline.refs.length && needSort) {
      cachedEvents = (
        await this.eventDataLoader.loadMany(timeline.refs.slice(0, filter.limit).map(([id]) => id))
      ).filter((evt) => !!evt && !(evt instanceof Error)) as NEvent[]
      if (cachedEvents.length) {
        onEvents([...cachedEvents], false)
        since = cachedEvents[0].created_at + 1
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    let events: NEvent[] = []
    let eosedAt: number | null = null
    const subCloser = this.subscribe(relays, since ? { ...filter, since } : filter, {
      startLogin,
      onevent: (evt: NEvent) => {
        that.addEventToCache(evt)
        // not eosed yet, push to events
        if (!eosedAt) {
          return events.push(evt)
        }
        // new event
        if (evt.created_at > eosedAt) {
          onNew(evt)
        }

        const timeline = that.timelines[key]
        if (!timeline || Array.isArray(timeline) || !timeline.refs.length) {
          return
        }

        // find the right position to insert
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
      oneose: (eosed) => {
        if (eosed && !eosedAt) {
          eosedAt = dayjs().unix()
        }
        // (algo feeds) no need to sort and cache
        if (!needSort) {
          return onEvents([...events], !!eosedAt)
        }
        if (!eosed) {
          events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit)
          return onEvents([...events.concat(cachedEvents).slice(0, filter.limit)], false)
        }

        events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit)
        const timeline = that.timelines[key]
        // no cache yet
        if (!timeline || Array.isArray(timeline) || !timeline.refs.length) {
          that.timelines[key] = {
            refs: events.map((evt) => [evt.id, evt.created_at]),
            filter,
            urls
          }
          return onEvents([...events], true)
        }

        // Prevent concurrent requests from duplicating the same event
        const firstRefCreatedAt = timeline.refs[0][1]
        const newRefs = events
          .filter((evt) => evt.created_at > firstRefCreatedAt)
          .map((evt) => [evt.id, evt.created_at] as TTimelineRef)

        if (events.length >= filter.limit) {
          // if new refs are more than limit, means old refs are too old, replace them
          timeline.refs = newRefs
          onEvents([...events], true)
        } else {
          // merge new refs with old refs
          timeline.refs = newRefs.concat(timeline.refs)
          onEvents([...events.concat(cachedEvents).slice(0, filter.limit)], true)
        }
      },
      onclose: onClose
    })

    return {
      timelineKey: key,
      closer: () => {
        onEvents = () => {}
        onNew = () => {}
        subCloser.close()
      }
    }
  }

  private async _loadMoreTimeline(key: string, until: number, limit: number) {
    const timeline = this.timelines[key]
    if (!timeline || Array.isArray(timeline)) return []

    const { filter, urls, refs } = timeline
    const startIdx = refs.findIndex(([, createdAt]) => createdAt <= until)
    const cachedEvents =
      startIdx >= 0
        ? ((
            await this.eventDataLoader.loadMany(
              refs.slice(startIdx, startIdx + limit).map(([id]) => id)
            )
          ).filter((evt) => !!evt && !(evt instanceof Error)) as NEvent[])
        : []
    if (cachedEvents.length >= limit) {
      return cachedEvents
    }

    until = cachedEvents.length ? cachedEvents[cachedEvents.length - 1].created_at - 1 : until
    limit = limit - cachedEvents.length
    let events = await this.query(urls, { ...filter, until, limit })
    events.forEach((evt) => {
      this.addEventToCache(evt)
    })
    events = events.sort((a, b) => b.created_at - a.created_at).slice(0, limit)

    // Prevent concurrent requests from duplicating the same event
    const lastRefCreatedAt = refs.length > 0 ? refs[refs.length - 1][1] : dayjs().unix()
    timeline.refs.push(
      ...events
        .filter((evt) => evt.created_at < lastRefCreatedAt)
        .map((evt) => [evt.id, evt.created_at] as TTimelineRef)
    )
    return [...cachedEvents, ...events]
  }

  /** =========== Event =========== */

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

  private async query(urls: string[], filter: Filter | Filter[], onevent?: (evt: NEvent) => void) {
    return await new Promise<NEvent[]>((resolve) => {
      const events: NEvent[] = []
      const sub = this.subscribe(urls, filter, {
        onevent(evt) {
          onevent?.(evt)
          events.push(evt)
        },
        oneose: (eosed) => {
          if (eosed) {
            sub.close()
            resolve(events)
          }
        },
        onclose: () => {
          resolve(events)
        }
      })
    })
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
    const events = await this.query(relays.length > 0 ? relays : BIG_RELAY_URLS, filter, onevent)
    if (cache) {
      events.forEach((evt) => {
        this.addEventToCache(evt)
      })
    }
    return events
  }

  async fetchEvent(id: string): Promise<NEvent | undefined> {
    if (!/^[0-9a-f]{64}$/.test(id)) {
      let eventId: string | undefined
      let coordinate: string | undefined
      const { type, data } = nip19.decode(id)
      switch (type) {
        case 'note':
          eventId = data
          break
        case 'nevent':
          eventId = data.id
          break
        case 'naddr':
          coordinate = getReplaceableCoordinate(data.kind, data.pubkey, data.identifier)
          break
      }
      if (coordinate) {
        const cache = this.replaceableEventCacheMap.get(coordinate)
        if (cache) {
          return cache
        }
      } else if (eventId) {
        const cache = this.eventCacheMap.get(eventId)
        if (cache) {
          return cache
        }
      }
    }
    return this.eventDataLoader.load(id)
  }

  async fetchTrendingNotes() {
    if (this.trendingNotesCache) {
      return this.trendingNotesCache
    }

    try {
      const response = await fetch('https://api.nostr.band/v0/trending/notes')
      const data = await response.json()
      const events: NEvent[] = []
      for (const note of data.notes ?? []) {
        if (validateEvent(note.event)) {
          events.push(note.event)
          this.addEventToCache(note.event)
          if (note.relays?.length) {
            note.relays.map((r: string) => {
              try {
                const relay = new Relay(r)
                this.trackEventSeenOn(note.event.id, relay)
              } catch {
                return null
              }
            })
          }
        }
      }
      this.trendingNotesCache = events
      return this.trendingNotesCache
    } catch (error) {
      console.error('fetchTrendingNotes error', error)
      return []
    }
  }

  addEventToCache(event: NEvent) {
    this.eventDataLoader.prime(event.id, Promise.resolve(event))
    if (isReplaceableEvent(event.kind)) {
      const coordinate = getReplaceableCoordinateFromEvent(event)
      const cachedEvent = this.replaceableEventCacheMap.get(coordinate)
      if (!cachedEvent || compareEvents(event, cachedEvent) > 0) {
        this.replaceableEventCacheMap.set(coordinate, event)
      }
    }
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
    let author: string | undefined
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
          if (data.author) author = data.author
          break
        case 'naddr':
          filter = {
            authors: [data.pubkey],
            kinds: [data.kind],
            limit: 1
          }
          author = data.pubkey
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
    if (filter.ids?.length) {
      event = await this.fetchEventById(relays, filter.ids[0])
    }

    if (!event && author) {
      const relayList = await this.fetchRelayList(author)
      event = await this.tryHarderToFetchEvent(relayList.write.slice(0, 5), filter)
    }

    if (event && event.id !== id) {
      this.addEventToCache(event)
    }

    return event
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

  /** =========== Following favorite relays =========== */

  private followingFavoriteRelaysCache = new LRUCache<string, Promise<[string, string[]][]>>({
    max: 10,
    fetchMethod: this._fetchFollowingFavoriteRelays.bind(this)
  })

  async fetchFollowingFavoriteRelays(pubkey: string) {
    return this.followingFavoriteRelaysCache.fetch(pubkey)
  }

  private async _fetchFollowingFavoriteRelays(pubkey: string) {
    const fetchNewData = async () => {
      const followings = await this.fetchFollowings(pubkey)
      const events = await this.fetchEvents(BIG_RELAY_URLS, {
        authors: followings,
        kinds: [ExtendedKind.FAVORITE_RELAYS, kinds.Relaysets],
        limit: 1000
      })
      const alreadyExistsFavoriteRelaysPubkeySet = new Set<string>()
      const alreadyExistsRelaySetsPubkeySet = new Set<string>()
      const uniqueEvents: NEvent[] = []
      events
        .sort((a, b) => b.created_at - a.created_at)
        .forEach((event) => {
          if (event.kind === ExtendedKind.FAVORITE_RELAYS) {
            if (alreadyExistsFavoriteRelaysPubkeySet.has(event.pubkey)) return
            alreadyExistsFavoriteRelaysPubkeySet.add(event.pubkey)
          } else if (event.kind === kinds.Relaysets) {
            if (alreadyExistsRelaySetsPubkeySet.has(event.pubkey)) return
            alreadyExistsRelaySetsPubkeySet.add(event.pubkey)
          } else {
            return
          }
          uniqueEvents.push(event)
        })

      const relayMap = new Map<string, Set<string>>()
      uniqueEvents.forEach((event) => {
        event.tags.forEach(([tagName, tagValue]) => {
          if (tagName === 'relay' && tagValue && isWebsocketUrl(tagValue)) {
            const url = normalizeUrl(tagValue)
            relayMap.set(url, (relayMap.get(url) || new Set()).add(event.pubkey))
          }
        })
      })
      const relayMapEntries = Array.from(relayMap.entries())
        .sort((a, b) => b[1].size - a[1].size)
        .map(([url, pubkeys]) => [url, Array.from(pubkeys)]) as [string, string[]][]

      indexedDb.putFollowingFavoriteRelays(pubkey, relayMapEntries)
      return relayMapEntries
    }

    const cached = await indexedDb.getFollowingFavoriteRelays(pubkey)
    if (cached) {
      fetchNewData()
      return cached
    }
    return fetchNewData()
  }

  /** =========== Followings =========== */

  async initUserIndexFromFollowings(pubkey: string, signal: AbortSignal) {
    const followings = await this.fetchFollowings(pubkey)
    for (let i = 0; i * 20 < followings.length; i++) {
      if (signal.aborted) return
      await Promise.all(
        followings.slice(i * 20, (i + 1) * 20).map((pubkey) => this.fetchProfileEvent(pubkey))
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  /** =========== Profile =========== */

  async searchProfiles(relayUrls: string[], filter: Filter): Promise<TProfile[]> {
    const events = await this.query(relayUrls, {
      ...filter,
      kinds: [kinds.Metadata]
    })

    const profileEvents = events.sort((a, b) => b.created_at - a.created_at)
    await Promise.allSettled(profileEvents.map((profile) => this.addUsernameToIndex(profile)))
    profileEvents.forEach((profile) => this.updateProfileEventCache(profile))
    return profileEvents.map((profileEvent) => getProfileFromEvent(profileEvent))
  }

  async searchNpubsFromLocal(query: string, limit: number = 100) {
    const result = await this.userIndex.searchAsync(query, { limit })
    return result.map((pubkey) => pubkeyToNpub(pubkey as string)).filter(Boolean) as string[]
  }

  async searchProfilesFromLocal(query: string, limit: number = 100) {
    const npubs = await this.searchNpubsFromLocal(query, limit)
    const profiles = await Promise.all(npubs.map((npub) => this.fetchProfile(npub)))
    return profiles.filter((profile) => !!profile) as TProfile[]
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
        return localProfile
      }
    }
    const profileFromBigRelays = await this.replaceableEventFromBigRelaysDataloader.load({
      pubkey,
      kind: kinds.Metadata
    })
    if (profileFromBigRelays) {
      this.addUsernameToIndex(profileFromBigRelays)
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
    const profileEvent = await this.fetchProfileEvent(id, skipCache)
    if (profileEvent) {
      return getProfileFromEvent(profileEvent)
    }

    try {
      const pubkey = userIdToPubkey(id)
      return { pubkey, npub: pubkeyToNpub(pubkey) ?? '', username: formatPubkey(pubkey) }
    } catch {
      return undefined
    }
  }

  async updateProfileEventCache(event: NEvent) {
    await this.updateReplaceableEventFromBigRelaysCache(event)
  }

  /** =========== Relay list =========== */

  async fetchRelayListEvent(pubkey: string) {
    const [relayEvent] = await this.fetchReplaceableEventsFromBigRelays([pubkey], kinds.RelayList)
    return relayEvent ?? null
  }

  async fetchRelayList(pubkey: string): Promise<TRelayList> {
    const [relayList] = await this.fetchRelayLists([pubkey])
    return relayList
  }

  async fetchRelayLists(pubkeys: string[]): Promise<TRelayList[]> {
    const relayEvents = await this.fetchReplaceableEventsFromBigRelays(pubkeys, kinds.RelayList)

    return relayEvents.map((event) => {
      if (event) {
        return getRelayListFromEvent(event)
      }
      return {
        write: BIG_RELAY_URLS,
        read: BIG_RELAY_URLS,
        originalRelays: []
      }
    })
  }

  async forceUpdateRelayListEvent(pubkey: string) {
    await this.replaceableEventBatchLoadFn([{ pubkey, kind: kinds.RelayList }])
  }

  async updateRelayListCache(event: NEvent) {
    await this.updateReplaceableEventFromBigRelaysCache(event)
  }

  /** =========== Replaceable event from big relays dataloader =========== */

  private replaceableEventFromBigRelaysDataloader = new DataLoader<
    { pubkey: string; kind: number },
    NEvent | null,
    string
  >(this.replaceableEventFromBigRelaysBatchLoadFn.bind(this), {
    batchScheduleFn: (callback) => setTimeout(callback, 50),
    maxBatchSize: 500,
    cacheKeyFn: ({ pubkey, kind }) => `${pubkey}:${kind}`
  })

  private async replaceableEventFromBigRelaysBatchLoadFn(
    params: readonly { pubkey: string; kind: number }[]
  ) {
    const groups = new Map<number, string[]>()
    params.forEach(({ pubkey, kind }) => {
      if (!groups.has(kind)) {
        groups.set(kind, [])
      }
      groups.get(kind)!.push(pubkey)
    })

    const eventsMap = new Map<string, NEvent>()
    await Promise.allSettled(
      Array.from(groups.entries()).map(async ([kind, pubkeys]) => {
        const events = await this.query(BIG_RELAY_URLS, {
          authors: pubkeys,
          kinds: [kind]
        })

        for (const event of events) {
          const key = `${event.pubkey}:${event.kind}`
          const existing = eventsMap.get(key)
          if (!existing || existing.created_at < event.created_at) {
            eventsMap.set(key, event)
          }
        }
      })
    )

    return params.map(({ pubkey, kind }) => {
      const key = `${pubkey}:${kind}`
      const event = eventsMap.get(key)
      if (event) {
        indexedDb.putReplaceableEvent(event)
        return event
      } else {
        indexedDb.putNullReplaceableEvent(pubkey, kind)
        return null
      }
    })
  }

  private async fetchReplaceableEventsFromBigRelays(pubkeys: string[], kind: number) {
    const events = await indexedDb.getManyReplaceableEvents(pubkeys, kind)
    const nonExistingPubkeyIndexMap = new Map<string, number>()
    pubkeys.forEach((pubkey, i) => {
      if (events[i] === undefined) {
        nonExistingPubkeyIndexMap.set(pubkey, i)
      }
    })
    const newEvents = await this.replaceableEventFromBigRelaysDataloader.loadMany(
      Array.from(nonExistingPubkeyIndexMap.keys()).map((pubkey) => ({ pubkey, kind }))
    )
    newEvents.forEach((event) => {
      if (event && !(event instanceof Error)) {
        const index = nonExistingPubkeyIndexMap.get(event.pubkey)
        if (index !== undefined) {
          events[index] = event
        }
      }
    })

    return events
  }

  private async updateReplaceableEventFromBigRelaysCache(event: NEvent) {
    this.replaceableEventFromBigRelaysDataloader.clear({ pubkey: event.pubkey, kind: event.kind })
    this.replaceableEventFromBigRelaysDataloader.prime(
      { pubkey: event.pubkey, kind: event.kind },
      Promise.resolve(event)
    )
    await indexedDb.putReplaceableEvent(event)
  }

  /** =========== Replaceable event dataloader =========== */

  private replaceableEventDataLoader = new DataLoader<
    { pubkey: string; kind: number; d?: string },
    NEvent | null,
    string
  >(this.replaceableEventBatchLoadFn.bind(this), {
    cacheKeyFn: ({ pubkey, kind, d }) => `${kind}:${pubkey}:${d ?? ''}`
  })

  private async replaceableEventBatchLoadFn(
    params: readonly { pubkey: string; kind: number; d?: string }[]
  ) {
    const groups = new Map<string, { kind: number; d?: string }[]>()
    params.forEach(({ pubkey, kind, d }) => {
      if (!groups.has(pubkey)) {
        groups.set(pubkey, [])
      }
      groups.get(pubkey)!.push({ kind: kind, d })
    })

    const eventMap = new Map<string, NEvent | null>()
    await Promise.allSettled(
      Array.from(groups.entries()).map(async ([pubkey, _params]) => {
        const groupByKind = new Map<number, string[]>()
        _params.forEach(({ kind, d }) => {
          if (!groupByKind.has(kind)) {
            groupByKind.set(kind, [])
          }
          if (d) {
            groupByKind.get(kind)!.push(d)
          }
        })
        const filters = Array.from(groupByKind.entries()).map(
          ([kind, dList]) =>
            (dList.length > 0
              ? {
                  authors: [pubkey],
                  kinds: [kind],
                  '#d': dList
                }
              : { authors: [pubkey], kinds: [kind] }) as Filter
        )
        const events = await this.query(BIG_RELAY_URLS, filters)

        for (const event of events) {
          const key = getReplaceableCoordinateFromEvent(event)
          const existing = eventMap.get(key)
          if (!existing || existing.created_at < event.created_at) {
            eventMap.set(key, event)
          }
        }
      })
    )

    return params.map(({ pubkey, kind, d }) => {
      const key = `${kind}:${pubkey}:${d ?? ''}`
      const event = eventMap.get(key)
      if (kind === kinds.Pinlist) return event ?? null

      if (event) {
        indexedDb.putReplaceableEvent(event)
        return event
      } else {
        indexedDb.putNullReplaceableEvent(pubkey, kind, d)
        return null
      }
    })
  }

  private async fetchReplaceableEvent(pubkey: string, kind: number, d?: string) {
    const storedEvent = await indexedDb.getReplaceableEvent(pubkey, kind, d)
    if (storedEvent !== undefined) {
      return storedEvent
    }

    return await this.replaceableEventDataLoader.load({ pubkey, kind, d })
  }

  private async updateReplaceableEventCache(event: NEvent) {
    this.replaceableEventDataLoader.clear({ pubkey: event.pubkey, kind: event.kind })
    this.replaceableEventDataLoader.prime(
      { pubkey: event.pubkey, kind: event.kind },
      Promise.resolve(event)
    )
    await indexedDb.putReplaceableEvent(event)
  }

  /** =========== Replaceable event =========== */

  async fetchFollowListEvent(pubkey: string) {
    return await this.fetchReplaceableEvent(pubkey, kinds.Contacts)
  }

  async fetchFollowings(pubkey: string) {
    const followListEvent = await this.fetchFollowListEvent(pubkey)
    return followListEvent ? getPubkeysFromPTags(followListEvent.tags) : []
  }

  async updateFollowListCache(evt: NEvent) {
    await this.updateReplaceableEventCache(evt)
  }

  async fetchMuteListEvent(pubkey: string) {
    return await this.fetchReplaceableEvent(pubkey, kinds.Mutelist)
  }

  async fetchBookmarkListEvent(pubkey: string) {
    return this.fetchReplaceableEvent(pubkey, kinds.BookmarkList)
  }

  async fetchBlossomServerListEvent(pubkey: string) {
    return await this.fetchReplaceableEvent(pubkey, ExtendedKind.BLOSSOM_SERVER_LIST)
  }

  async fetchBlossomServerList(pubkey: string) {
    const evt = await this.fetchBlossomServerListEvent(pubkey)
    return evt ? getServersFromServerTags(evt.tags) : []
  }

  async fetchPinListEvent(pubkey: string) {
    return this.fetchReplaceableEvent(pubkey, kinds.Pinlist)
  }

  async updateBlossomServerListEventCache(evt: NEvent) {
    await this.updateReplaceableEventCache(evt)
  }

  async fetchEmojiSetEvents(pointers: string[]) {
    const params = pointers
      .map((pointer) => {
        const [kindStr, pubkey, d = ''] = pointer.split(':')
        if (!pubkey || !kindStr) return null

        const kind = parseInt(kindStr, 10)
        if (kind !== kinds.Emojisets) return null

        return { pubkey, kind, d }
      })
      .filter(Boolean) as { pubkey: string; kind: number; d: string }[]
    return await this.replaceableEventDataLoader.loadMany(params)
  }

  // ================= Utils =================

  async generateSubRequestsForPubkeys(pubkeys: string[], myPubkey?: string | null) {
    // If many websocket connections are initiated simultaneously, it will be
    // very slow on Safari (for unknown reason)
    if (isSafari()) {
      let urls = BIG_RELAY_URLS
      if (myPubkey) {
        const relayList = await this.fetchRelayList(myPubkey)
        urls = relayList.read.concat(BIG_RELAY_URLS).slice(0, 5)
      }
      return [{ urls, filter: { authors: pubkeys } }]
    }

    const relayLists = await this.fetchRelayLists(pubkeys)
    const group: Record<string, Set<string>> = {}
    relayLists.forEach((relayList, index) => {
      relayList.write.slice(0, 4).forEach((url) => {
        if (!group[url]) {
          group[url] = new Set()
        }
        group[url].add(pubkeys[index])
      })
    })

    const relayCount = Object.keys(group).length
    const coveredCount = new Map<string, number>()
    Object.entries(group)
      .sort(([, a], [, b]) => b.size - a.size)
      .forEach(([url, pubkeys]) => {
        if (
          relayCount > 10 &&
          pubkeys.size < 10 &&
          Array.from(pubkeys).every((pubkey) => (coveredCount.get(pubkey) ?? 0) >= 2)
        ) {
          delete group[url]
        } else {
          pubkeys.forEach((pubkey) => {
            coveredCount.set(pubkey, (coveredCount.get(pubkey) ?? 0) + 1)
          })
        }
      })

    return Object.entries(group).map(([url, authors]) => ({
      urls: [url],
      filter: { authors: Array.from(authors) }
    }))
  }
}

const instance = ClientService.getInstance()
export default instance
