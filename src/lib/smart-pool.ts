import { SimplePool } from 'nostr-tools'
import { AbstractRelay } from 'nostr-tools/abstract-relay'
import { IRelay, IRelayPool } from '../types/relay-pool'
import { isInsecureUrl } from './url'

const DEFAULT_CONNECTION_TIMEOUT = 10 * 1000 // 10 seconds
const CLEANUP_THRESHOLD = 15 // number of relays to trigger cleanup
const CLEANUP_INTERVAL = 30 * 1000 // 30 seconds
const IDLE_TIMEOUT = 10 * 1000 // 10 seconds

export type SmartPoolOptions = {
  allowInsecure?: boolean
}

export class SmartPool extends SimplePool implements IRelayPool {
  private relayIdleTracker = new Map<string, number>()
  private allowInsecure: boolean

  constructor(options: SmartPoolOptions = {}) {
    super({ enablePing: true, enableReconnect: true })

    this.allowInsecure = options.allowInsecure ?? false

    // Periodically clean up idle relays
    setInterval(() => this.cleanIdleRelays(), CLEANUP_INTERVAL)
  }

  setAllowInsecure(allow: boolean) {
    this.allowInsecure = allow
  }

  getSeenRelays(eventId: string): IRelay[] {
    return Array.from(this.seenOn.get(eventId)?.values() ?? [])
  }

  trackEventSeen(eventId: string, relay: IRelay) {
    let set = this.seenOn.get(eventId)
    if (!set) {
      set = new Set()
      this.seenOn.set(eventId, set)
    }
    set.add(relay as AbstractRelay)
  }

  ensureRelay(url: string): Promise<AbstractRelay> {
    if (!this.allowInsecure && isInsecureUrl(url)) {
      return Promise.reject(new Error(`Insecure relay connection blocked: ${url}`))
    }
    // If relay is new and we have many relays, trigger cleanup
    if (!this.relayIdleTracker.has(url) && this.relayIdleTracker.size > CLEANUP_THRESHOLD) {
      this.cleanIdleRelays()
    }
    // Update last activity time
    this.relayIdleTracker.set(url, Date.now())
    return super.ensureRelay(url, { connectionTimeout: DEFAULT_CONNECTION_TIMEOUT })
  }

  private cleanIdleRelays() {
    const idleRelays: string[] = []
    this.relays.forEach((relay, url) => {
      // If relay is disconnected or has active subscriptions, skip
      if (!relay.connected || relay.openSubs.size > 0) return

      const lastActivity = this.relayIdleTracker.get(url) ?? 0
      // If relay active recently, skip
      if (Date.now() - lastActivity < IDLE_TIMEOUT) return

      idleRelays.push(url)
      this.relayIdleTracker.delete(url)
    })

    if (idleRelays.length > 0) {
      console.log('[SmartPool] Closing idle relays:', idleRelays)
      this.close(idleRelays)
    }
  }
}
