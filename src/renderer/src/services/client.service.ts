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
        // 'wss://relay.damus.io'
        // 'wss://nostr-relay.app'
        'ws://localhost:4869'
      ])
      ClientService.instance = this
    }
    return ClientService.instance
  }

  fetchEvents(
    filters: Filter[],
    {
      next,
      complete,
      error
    }: {
      next: (event: Event) => void
      complete?: () => void
      error?: (err: Error) => void
    }
  ) {
    const rxReq = createRxBackwardReq()
    this.rxNostr.use(rxReq).subscribe({
      next: (packet) => next(packet.event),
      complete,
      error
    })
    filters.forEach((filter) => rxReq.emit(filter))
    rxReq.over()
  }

  async fetchEventWithCache(filter: Filter) {
    return this.cache.fetch(JSON.stringify(filter))
  }

  async fetchEvent(filter: Filter) {
    return new Promise<Event | undefined>((resolver, reject) => {
      this.fetchEvents([{ ...filter, limit: 1 }], {
        next: (event) => resolver(event),
        complete: () => resolver(undefined),
        error: (err) => reject(err)
      })
    })
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
