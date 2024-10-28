import { LRUCache } from 'lru-cache'
import { Event, Filter, SimplePool } from 'nostr-tools'

class ClientService {
  static instance: ClientService

  private pool = new SimplePool()
  private relayUrls = [
    // 'wss://relay.damus.io'
    // 'wss://nostr-relay.app'
    'ws://localhost:4869'
  ]
  private cache = new LRUCache<string, Event>({
    max: 10000,
    fetchMethod: async (filter) => this.fetchEvent(JSON.parse(filter))
  })

  constructor() {
    if (!ClientService.instance) {
      ClientService.instance = this
    }
    return ClientService.instance
  }

  async fetchEvents(filter: Filter) {
    return await this.pool.querySync(this.relayUrls, filter)
  }

  async fetchEventWithCache(filter: Filter) {
    return this.cache.fetch(JSON.stringify(filter))
  }

  async fetchEvent(filter: Filter) {
    const events = await this.fetchEvents({ ...filter, limit: 1 })
    return events.length ? events[0] : undefined
  }
}

const instance = new ClientService()
Object.freeze(instance)

export default instance
