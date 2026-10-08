import { AbstractRelay, type AbstractRelayConstructorOptions } from 'nostr-tools/abstract-relay'
import { IRelay, IRelayPool } from '../types/relay-pool'
import { BoundedMap } from './bounded-map'
import { ManagedRelay } from './managed-relay'
import type { RelayObserver } from './relay-observation'
import { initializeNostrVerifier, verifyEvent } from './nostr-verifier'
import { observeRelayPoolLifecycle } from './relay-pool-lifecycle'
import { isInsecureUrl, normalizeUrl } from './url'

export type SmartPoolOptions = {
  observe?: RelayObserver
  allowInsecure?: boolean
  websocketImplementation?: AbstractRelayConstructorOptions['websocketImplementation']
}

/** Registry and lifecycle coordinator for per-URL ManagedRelay instances. */
export class SmartPool implements IRelayPool {
  trackRelays = true

  private observe?: RelayObserver
  private relays = new Map<string, ManagedRelay>()
  private seenOn = new BoundedMap<string, Set<IRelay>>({ maxSize: 100_000 })
  private healthCheckPromise?: Promise<void>
  private networkOnline = true
  private allowInsecure: boolean
  private trustedInsecureRelays = new Set<string>()
  private websocketImplementation?: AbstractRelayConstructorOptions['websocketImplementation']

  constructor(options: SmartPoolOptions = {}) {
    this.observe = options.observe
    this.allowInsecure = options.allowInsecure ?? false
    this.websocketImplementation = options.websocketImplementation
    void initializeNostrVerifier()
    observeRelayPoolLifecycle(this)
  }

  async ensureRelay(relayUrl: string): Promise<IRelay> {
    // Preserve ClientService's existing async contract. Connecting is lazy and
    // happens when the returned handle receives a publish/auth/subscribe call.
    return this.getRelay(relayUrl)
  }

  getRelay(relayUrl: string): IRelay {
    const url = normalizeUrl(relayUrl)
    let relay = this.relays.get(url)
    if (!relay) {
      const managedRelay = new ManagedRelay(
        url,
        () => this.createPhysicalRelay(url),
        () => this.assertConnectionAllowed(url),
        () => {
          // Do not let a pool that visits many relay URLs retain one wrapper
          // forever per URL. Seen-on entries remain independently bounded.
          if (this.relays.get(url) === managedRelay) this.relays.delete(url)
        },
        this.observe
      )
      managedRelay.setNetworkOnline(this.networkOnline)
      this.relays.set(url, managedRelay)
      relay = managedRelay
    }
    return relay
  }

  setAllowInsecure(allow: boolean) {
    this.allowInsecure = allow
  }

  setTrustedInsecureRelayUrls(urls: string[]) {
    this.trustedInsecureRelays = new Set(urls.map((url) => normalizeUrl(url)))
  }

  setNetworkOnline(online: boolean) {
    if (this.networkOnline === online) return
    this.networkOnline = online
    for (const relay of this.relays.values()) relay.setNetworkOnline(online)
  }

  checkRelays(): Promise<void> {
    // Online and visibility events often arrive together; they should share one
    // recovery pass instead of replacing every connection twice.
    if (this.healthCheckPromise) return this.healthCheckPromise
    if (!this.networkOnline) return Promise.resolve()

    const check = Promise.allSettled(
      Array.from(this.relays.values(), (relay) => relay.checkHealth())
    ).then(() => undefined)
    this.healthCheckPromise = check.finally(() => {
      this.healthCheckPromise = undefined
    })
    return this.healthCheckPromise
  }

  close(urls: string[]) {
    for (const relayUrl of urls) {
      const url = normalizeUrl(relayUrl)
      const relay = this.relays.get(url)
      this.relays.delete(url)
      relay?.shutdown('relay closed by pool')
    }
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
    set.add(relay)
  }

  listConnectionStatus(): Map<string, boolean> {
    return new Map(
      Array.from(this.relays, ([url, relay]) => [url, relay] as const)
        .filter(([, relay]) => relay.connected)
        .map(([url]) => [url, true])
    )
  }

  private createPhysicalRelay(url: string): AbstractRelay {
    return new AbstractRelay(url, {
      verifyEvent,
      websocketImplementation: this.websocketImplementation,
      enablePing: true,
      enableReconnect: false
    })
  }

  private assertConnectionAllowed(url: string) {
    if (
      !this.allowInsecure &&
      isInsecureUrl(url) &&
      !this.trustedInsecureRelays.has(normalizeUrl(url))
    ) {
      throw new Error(`Insecure relay connection blocked: ${url}`)
    }
  }
}
