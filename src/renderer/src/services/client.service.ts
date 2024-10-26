import { LRUCache } from 'lru-cache'
import { Event, Filter } from 'nostr-tools'
import { createRxBackwardReq, createRxNostr } from 'rx-nostr'
import { verifier } from 'rx-nostr-crypto'

class ClientService {
  static instance: ClientService

  private rxNostr = createRxNostr({ verifier })
  private cache = new LRUCache<string, Event>({
    max: 10000,
    fetchMethod: async (filter) => this.fetchEvent(JSON.parse(filter))
  })

  constructor() {
    if (!ClientService.instance) {
      this.rxNostr.setDefaultRelays(['wss://relay.damus.io'])
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
}

const instance = new ClientService()
Object.freeze(instance)

export default instance
