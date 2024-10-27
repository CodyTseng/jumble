import { LRUCache } from 'lru-cache'
import { Event, Filter } from 'nostr-tools'
import { createRxBackwardReq, createRxForwardReq, createRxNostr } from 'rx-nostr'
import { verifier } from 'rx-nostr-crypto'
import { take } from 'rxjs/operators'

class ClientService {
  static instance: ClientService

  private rxNostr = createRxNostr({ verifier })
  private cache = new LRUCache<string, Event>({
    max: 10000,
    fetchMethod: async (filter) => this.fetchEvent(JSON.parse(filter))
  })

  constructor() {
    if (!ClientService.instance) {
      this.rxNostr.setDefaultRelays([
        'wss://relay.damus.io'
        // 'wss://nostr-relay.app'
        // 'ws://localhost:4869'
      ])
      ClientService.instance = this
    }
    return ClientService.instance
  }

  fetchEvents(filters: Filter[]) {
    return new Promise<Event[]>((resolver, reject) => {
      const rxReq = createRxBackwardReq()
      const events: Event[] = []
      const eventIdSet = new Set<string>()
      this.rxNostr.use(rxReq).subscribe({
        next: (packet) => {
          const event = packet.event
          if (!eventIdSet.has(event.id)) {
            eventIdSet.add(event.id)
            events.push(event)
          }
        },
        complete: () => resolver(events),
        error: (err) => reject(err)
      })
      filters.forEach((filter) => rxReq.emit(filter))
      rxReq.over()
    })
  }

  async fetchEventWithCache(filter: Filter) {
    return this.cache.fetch(JSON.stringify(filter))
  }

  async fetchEvent(filter: Filter) {
    const events = await this.fetchEvents([{ ...filter, limit: 1 }])
    return events.length ? events[0] : undefined
  }

  listenNewEvents(filter: Filter, next: (event: Event) => void, limit?: number) {
    const rxReq = createRxForwardReq()
    const observable = this.rxNostr.use(rxReq)
    if (limit !== undefined) {
      observable.pipe(take(limit))
    }
    const subscription = observable.subscribe((packet) => next(packet.event))
    rxReq.emit(filter)
    return subscription
  }
}

const instance = new ClientService()
Object.freeze(instance)

export default instance
