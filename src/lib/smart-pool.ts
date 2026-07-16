import { AbstractSimplePool } from 'nostr-tools/abstract-pool'
import { AbstractRelay, type AbstractRelayConstructorOptions } from 'nostr-tools/abstract-relay'
import { IRelay, IRelayPool } from '../types/relay-pool'
import { BoundedMap } from './bounded-map'
import { initializeNostrVerifier, verifyEvent } from './nostr-verifier'
import { isInsecureUrl, normalizeUrl } from './url'

const DEFAULT_CONNECTION_TIMEOUT = 10 * 1000 // 10 seconds
const CLEANUP_THRESHOLD = 15 // number of relays to trigger cleanup
const CLEANUP_INTERVAL = 30 * 1000 // 30 seconds
const IDLE_TIMEOUT = 10 * 1000 // 10 seconds

export type SmartPoolOptions = {
  allowInsecure?: boolean
  websocketImplementation?: AbstractRelayConstructorOptions['websocketImplementation']
}

export class SmartPool extends AbstractSimplePool implements IRelayPool {
  private relayIdleTracker = new Map<string, number>()
  private allowInsecure: boolean
  // Insecure (ws://) relays the user explicitly opted into — their own
  // read/write relays, relay sets, defaults, or a relay they are actively
  // browsing. Insecure relays coming from other people's data are NOT here, so
  // they get rejected below. Stored as normalized URLs.
  private trustedInsecureRelays = new Set<string>()

  constructor(options: SmartPoolOptions = {}) {
    super({
      verifyEvent,
      websocketImplementation: options.websocketImplementation,
      enablePing: true,
      enableReconnect: true,
      maxWaitForConnection: 3_000
    })

    // nostr-tools keeps every event-to-relay observation forever by default.
    // Relay hints are opportunistic, so retaining only recent events is enough.
    this.seenOn = new BoundedMap<string, Set<AbstractRelay>>({ maxSize: 100_000 })

    this.allowInsecure = options.allowInsecure ?? false

    // Verification falls back to pure JS until this finishes, and keeps using
    // that fallback if WASM is unavailable in the current runtime.
    void initializeNostrVerifier()

    // Periodically clean up idle relays
    setInterval(() => this.cleanIdleRelays(), CLEANUP_INTERVAL)
  }

  setAllowInsecure(allow: boolean) {
    this.allowInsecure = allow
  }

  setTrustedInsecureRelayUrls(urls: string[]) {
    this.trustedInsecureRelays = new Set(urls.map((url) => normalizeUrl(url)))
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
    if (
      !this.allowInsecure &&
      isInsecureUrl(url) &&
      !this.trustedInsecureRelays.has(normalizeUrl(url))
    ) {
      return Promise.reject(new Error(`Insecure relay connection blocked: ${url}`))
    }
    const normalizedUrl = normalizeUrl(url)
    // If relay is new and we have many relays, trigger cleanup
    if (
      !this.relayIdleTracker.has(normalizedUrl) &&
      this.relayIdleTracker.size > CLEANUP_THRESHOLD
    ) {
      this.cleanIdleRelays()
    }
    // Update last activity time
    this.relayIdleTracker.set(normalizedUrl, Date.now())
    return super.ensureRelay(url, { connectionTimeout: DEFAULT_CONNECTION_TIMEOUT })
  }

  private cleanIdleRelays() {
    const idleRelays: string[] = []
    this.relays.forEach((relay, url) => {
      // Active subscriptions own their relay. Disconnected relays, however,
      // should be removed instead of keeping their tracker entry forever.
      if (relay.openSubs.size > 0) return
      if (!relay.connected) {
        idleRelays.push(url)
        this.relayIdleTracker.delete(url)
        return
      }

      const lastActivity = this.relayIdleTracker.get(url) ?? 0
      // If relay active recently, skip
      if (Date.now() - lastActivity < IDLE_TIMEOUT) return

      idleRelays.push(url)
      this.relayIdleTracker.delete(url)
    })

    // Failed connection attempts are removed from nostr-tools' relay map, but
    // they can still leave an idle-tracker entry behind.
    for (const url of this.relayIdleTracker.keys()) {
      if (!this.relays.has(url)) this.relayIdleTracker.delete(url)
    }

    if (idleRelays.length > 0) {
      console.log('[SmartPool] Closing idle relays:', idleRelays)
      this.close(idleRelays)
    }
  }
}
