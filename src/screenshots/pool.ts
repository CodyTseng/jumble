import type { IRelay, IRelayPool, TSubHandlers } from '@/types/relay-pool'
import { matchFilter, type Event, type Filter } from 'nostr-tools'
import { events } from './fixtures'

export function queryFixtures(filters: Filter[]): Event[] {
  const matches = new Map<string, Event>()
  for (const filter of filters) {
    const results = events
      .filter((event) => matchFilter(filter, event))
      .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id))
      .slice(0, filter.limit ?? events.length)
    for (const event of results) matches.set(event.id, event)
  }
  return [...matches.values()].sort((a, b) => b.created_at - a.created_at)
}

class ScreenshotRelay implements IRelay {
  publishTimeout = 0
  constructor(readonly url: string) {}

  async publish(): Promise<never> {
    throw new Error('Publishing is disabled in the screenshot demo')
  }

  async auth(): Promise<void> {}

  subscribe(filters: Filter[], handlers: TSubHandlers) {
    let closed = false
    // Defer delivery until the app has installed the subscription closer.
    queueMicrotask(() => {
      if (closed) return
      handlers.onrequest?.(Date.now())
      for (const event of queryFixtures(filters)) {
        if (closed) return
        handlers.ondata?.(Date.now())
        handlers.receivedEvent?.(this, event.id)
        if (!handlers.alreadyHaveEvent?.(event.id)) handlers.onevent?.(event)
      }
      if (!closed) handlers.oneose?.()
    })
    return {
      close: () => {
        closed = true
      }
    }
  }
}

/** A local, read-only transport. Never opens sockets or publishes fixture identities. */
export class SmartPool implements IRelayPool {
  trackRelays = true
  private relays = new Map<string, IRelay>()
  private seen = new Map<string, Set<IRelay>>()

  async ensureRelay(url: string) {
    let relay = this.relays.get(url)
    if (!relay) {
      relay = new ScreenshotRelay(url)
      this.relays.set(url, relay)
    }
    return relay
  }

  close() {}
  setAllowInsecure() {}
  setTrustedInsecureRelayUrls() {}
  getSeenRelays(id: string) {
    return [...(this.seen.get(id) ?? [])]
  }
  trackEventSeen(id: string, relay: IRelay) {
    const relays = this.seen.get(id) ?? new Set<IRelay>()
    relays.add(relay)
    this.seen.set(id, relays)
  }
}
