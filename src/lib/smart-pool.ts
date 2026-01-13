import { SimplePool } from 'nostr-tools'
import { AbstractRelay } from 'nostr-tools/abstract-relay'

const DEFAULT_CONNECTION_TIMEOUT = 10 * 1000 // 10 seconds
const CLEANUP_THRESHOLD = 15 // number of relays to trigger cleanup
const CLEANUP_INTERVAL = 30 * 1000 // 30 seconds
const IDLE_TIMEOUT = 10 * 1000 // 10 seconds

export class SmartPool extends SimplePool {
  private relayIdleTracker = new Map<string, number>()

  constructor() {
    super({ enablePing: true, enableReconnect: true })

    // Periodically clean up idle relays
    setInterval(() => this.cleanIdleRelays(), CLEANUP_INTERVAL)
  }

  ensureRelay(url: string): Promise<AbstractRelay> {
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
