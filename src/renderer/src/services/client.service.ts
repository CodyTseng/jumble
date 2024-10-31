import { TRelayGroup } from '@common/types'
import { TEventStats } from '@renderer/types'
import { LRUCache } from 'lru-cache'
import { Filter, kinds, Event as NEvent, SimplePool } from 'nostr-tools'
import { EVENT_TYPES, eventBus } from './event-bus.service'
import storage from './storage.service'

class ClientService {
  static instance: ClientService

  private pool = new SimplePool()
  private initPromise!: Promise<void>
  private relayUrls: string[] = []
  private cache = new LRUCache<string, NEvent>({
    max: 10000,
    fetchMethod: async (filter) => this.fetchEvent(JSON.parse(filter))
  })

  // Event cache
  private eventsCache = new LRUCache<string, Promise<NEvent | undefined>>({
    max: 10000,
    ttl: 1000 * 60 * 10 // 10 minutes
  })
  private fetchEventQueue = new Map<
    string,
    {
      resolve: (value: NEvent | undefined) => void
      reject: (reason: any) => void
    }
  >()
  private fetchEventTimer: NodeJS.Timeout | null = null

  // Event stats cache
  private eventStatsCache = new LRUCache<string, Promise<TEventStats>>({
    max: 10000,
    ttl: 1000 * 60 * 10, // 10 minutes
    fetchMethod: async (id) => this._fetchEventStatsById(id)
  })

  // Profile cache
  private profilesCache = new LRUCache<string, Promise<NEvent | undefined>>({
    max: 10000,
    ttl: 1000 * 60 * 10 // 10 minutes
  })
  private fetchProfileQueue = new Map<
    string,
    {
      resolve: (value: NEvent | undefined) => void
      reject: (reason: any) => void
    }
  >()
  private fetchProfileTimer: NodeJS.Timeout | null = null

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
    if (
      newRelayUrls.length === this.relayUrls.length &&
      newRelayUrls.every((url) => this.relayUrls.includes(url))
    ) {
      return
    }
    this.relayUrls = newRelayUrls
  }

  listConnectionStatus() {
    return this.pool.listConnectionStatus()
  }

  async fetchEvents(filters: Filter[]) {
    await this.initPromise
    return new Promise<NEvent[]>((resolve) => {
      const events: NEvent[] = []
      this.pool.subscribeManyEose(this.relayUrls, filters, {
        onevent(event) {
          events.push(event)
        },
        onclose() {
          resolve(events)
        }
      })
    })
  }

  async fetchEventWithCache(filter: Filter) {
    return this.cache.fetch(JSON.stringify(filter))
  }

  async fetchEvent(filter: Filter) {
    const events = await this.fetchEvents([{ ...filter, limit: 1 }])
    return events.length ? events[0] : undefined
  }

  async fetchEventById(id: string): Promise<NEvent | undefined> {
    const cache = this.eventsCache.get(id)
    if (cache) {
      return cache
    }

    const promise = new Promise<NEvent | undefined>((resolve, reject) => {
      this.fetchEventQueue.set(id, { resolve, reject })
      if (this.fetchEventTimer) {
        return
      }

      this.fetchEventTimer = setTimeout(async () => {
        this.fetchEventTimer = null
        const queue = new Map(this.fetchEventQueue)
        this.fetchEventQueue.clear()

        try {
          const ids = Array.from(queue.keys())
          const events = await this.fetchEvents([{ ids, limit: ids.length }])
          for (const event of events) {
            queue.get(event.id)?.resolve(event)
            queue.delete(event.id)
          }

          for (const [, job] of queue) {
            job.resolve(undefined)
          }
          queue.clear()
        } catch (err) {
          for (const [id, job] of queue) {
            this.eventsCache.delete(id)
            job.reject(err)
          }
        }
      }, 20)
    })

    this.eventsCache.set(id, promise)
    return promise
  }

  async fetchEventStatsById(id: string): Promise<TEventStats> {
    const stats = await this.eventStatsCache.fetch(id)
    return stats ?? { reactionCount: 0, repostCount: 0 }
  }

  private async _fetchEventStatsById(id: string) {
    const [reactionEvents, repostEvents] = await Promise.all([
      this.fetchEvents([{ '#e': [id], kinds: [kinds.Reaction] }]),
      this.fetchEvents([{ '#e': [id], kinds: [kinds.Repost] }])
    ])

    return { reactionCount: reactionEvents.length, repostCount: repostEvents.length }
  }

  async fetchProfile(pubkey: string): Promise<NEvent | undefined> {
    const cache = this.profilesCache.get(pubkey)
    if (cache) {
      return cache
    }

    const promise = new Promise<NEvent | undefined>((resolve, reject) => {
      this.fetchProfileQueue.set(pubkey, { resolve, reject })
      if (this.fetchProfileTimer) {
        return
      }

      this.fetchProfileTimer = setTimeout(async () => {
        this.fetchProfileTimer = null
        const queue = new Map(this.fetchProfileQueue)
        this.fetchProfileQueue.clear()

        try {
          const pubkeys = Array.from(queue.keys())
          const events = await this.fetchEvents([
            {
              authors: pubkeys,
              kinds: [0],
              limit: pubkeys.length
            }
          ])
          const eventsMap = new Map<string, NEvent>()
          for (const event of events) {
            const pubkey = event.pubkey
            const existing = eventsMap.get(pubkey)
            if (!existing || existing.created_at < event.created_at) {
              eventsMap.set(pubkey, event)
            }
          }

          for (const [pubkey, job] of queue) {
            const event = eventsMap.get(pubkey)
            if (event) {
              job.resolve(event)
            } else {
              job.resolve(undefined)
            }
            queue.delete(pubkey)
          }
        } catch (err) {
          for (const [pubkey, job] of queue) {
            this.profilesCache.delete(pubkey)
            job.reject(err)
          }
        }
      }, 20)
    })

    this.profilesCache.set(pubkey, promise)
    return promise
  }
}

const instance = new ClientService()

export default instance
