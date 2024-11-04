import { TRelayGroup } from '@common/types'
import { formatPubkey } from '@renderer/lib/pubkey'
import { TEventStats, TProfile } from '@renderer/types'
import DataLoader from 'dataloader'
import { LRUCache } from 'lru-cache'
import { Filter, kinds, Event as NEvent, SimplePool } from 'nostr-tools'
import { EVENT_TYPES, eventBus } from './event-bus.service'
import storage from './storage.service'

const BIG_RELAY_URLS = [
  'wss://relay.damus.io/',
  'wss://nos.lol/',
  'wss://relay.nostr.band/',
  'wss://relay.noswhere.com/'
]

class ClientService {
  static instance: ClientService

  private pool = new SimplePool()
  private relayUrls: string[] = BIG_RELAY_URLS
  private initPromise!: Promise<void>

  private eventStatsCache = new LRUCache<string, Promise<TEventStats>>({
    max: 10000,
    ttl: 1000 * 60 * 10, // 10 minutes
    fetchMethod: async (id) => this._fetchEventStatsById(id)
  })

  private eventCache = new LRUCache<string, Promise<NEvent | undefined>>({
    max: 10000,
    fetchMethod: async (filterStr) => {
      const [event] = await this.fetchEvents(JSON.parse(filterStr))
      return event
    }
  })

  private eventDataloader = new DataLoader<string, NEvent | undefined>(
    this.eventBatchLoadFn.bind(this),
    {
      cacheMap: new LRUCache<string, Promise<NEvent | undefined>>({ max: 10000 })
    }
  )

  private profileDataloader = new DataLoader<string, TProfile | undefined>(
    this.profileBatchLoadFn.bind(this),
    {
      cacheMap: new LRUCache<string, Promise<TProfile | undefined>>({ max: 10000 })
    }
  )

  constructor() {
    if (!ClientService.instance) {
      this.initPromise = this.init()
      ClientService.instance = this
    }
    return ClientService.instance
  }

  async init() {
    const relayGroups = await storage.getRelayGroups()
    this.relayUrls = relayGroups.find((group) => group.isActive)?.relayUrls ?? []
    eventBus.on(EVENT_TYPES.RELAY_GROUPS_CHANGED, (event) => {
      this.onRelayGroupsChange(event.detail)
    })
  }

  onRelayGroupsChange(relayGroups: TRelayGroup[]) {
    const newRelayUrls = relayGroups.find((group) => group.isActive)?.relayUrls ?? []
    this.relayUrls = newRelayUrls
  }

  listConnectionStatus() {
    return this.pool.listConnectionStatus()
  }

  async publishEvent(event: NEvent) {
    // TODO: outbox
    return await Promise.any(this.pool.publish(this.relayUrls, event))
  }

  subscribeEvents(
    urls: string[],
    filter: Filter,
    opts: {
      onEose: (events: NEvent[]) => void
      onNew: (evt: NEvent) => void
    }
  ) {
    const events: NEvent[] = []
    let eose = false
    return this.pool.subscribeMany(urls, [filter], {
      onevent: (evt) => {
        if (eose) {
          opts.onNew(evt)
        } else {
          events.push(evt)
        }
      },
      oneose: () => {
        eose = true
        opts.onEose(events.sort((a, b) => b.created_at - a.created_at))
      },
      onclose: () => {
        if (!eose) {
          opts.onEose(events.sort((a, b) => b.created_at - a.created_at))
        }
      }
    })
  }

  async fetchEvents(filter: Filter, relayUrls: string[] = this.relayUrls) {
    await this.initPromise
    return await this.pool.querySync(relayUrls, filter)
  }

  async fetchEventStatsById(id: string): Promise<TEventStats> {
    const stats = await this.eventStatsCache.fetch(id)
    return stats ?? { reactionCount: 0, repostCount: 0 }
  }

  async fetchEventByFilter(filter: Filter) {
    return this.eventCache.fetch(JSON.stringify({ ...filter, limit: 1 }))
  }

  async fetchEventById(id: string): Promise<NEvent | undefined> {
    return this.eventDataloader.load(id)
  }

  async fetchProfile(pubkey: string): Promise<TProfile | undefined> {
    return this.profileDataloader.load(pubkey)
  }

  private async _fetchEventStatsById(id: string) {
    const [reactionEvents, repostEvents] = await Promise.all([
      this.fetchEvents({ '#e': [id], kinds: [kinds.Reaction] }),
      this.fetchEvents({ '#e': [id], kinds: [kinds.Repost] })
    ])

    return { reactionCount: reactionEvents.length, repostCount: repostEvents.length }
  }

  private async eventBatchLoadFn(ids: readonly string[]) {
    const events = await this.fetchEvents({
      ids: ids as string[],
      limit: ids.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      eventsMap.set(event.id, event)
    }

    const missingIds = ids.filter((id) => !eventsMap.has(id))
    if (missingIds.length > 0) {
      const missingEvents = await this.fetchEvents(
        {
          ids: missingIds,
          limit: missingIds.length
        },
        BIG_RELAY_URLS.filter((url) => !this.relayUrls.includes(url))
      )
      for (const event of missingEvents) {
        eventsMap.set(event.id, event)
      }
    }

    return ids.map((id) => eventsMap.get(id))
  }

  private async profileBatchLoadFn(pubkeys: readonly string[]) {
    const events = await this.fetchEvents({
      authors: pubkeys as string[],
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

    const missingPubkeys = pubkeys.filter((pubkey) => !eventsMap.has(pubkey))
    if (missingPubkeys.length > 0) {
      const missingEvents = await this.fetchEvents(
        {
          authors: missingPubkeys,
          kinds: [kinds.Metadata],
          limit: missingPubkeys.length
        },
        BIG_RELAY_URLS.filter((url) => !this.relayUrls.includes(url))
      )
      for (const event of missingEvents) {
        const pubkey = event.pubkey
        const existing = eventsMap.get(pubkey)
        if (!existing || existing.created_at < event.created_at) {
          eventsMap.set(pubkey, event)
        }
      }
    }

    return pubkeys.map((pubkey) => {
      const event = eventsMap.get(pubkey)
      return event ? this.parseProfileFromEvent(event) : undefined
    })
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
        about: profileObj.about
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

const instance = new ClientService()

export default instance
