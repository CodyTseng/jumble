import type { Filter, Event as NEvent } from 'nostr-tools'
import type { TElectronBridge } from '../../electron/shared/ipc-types'
import type {
  IRelay,
  IRelayPool,
  TSignAuthEvent,
  TSubCloser,
  TSubHandlers
} from '@/types/relay-pool'
import { getElectronBridge } from './platform'
import relayObservations from '@/services/relay-observation.service'
import { normalizeUrl } from './url'
import { BoundedMap } from './bounded-map'
import { observeRelayPoolLifecycle } from './relay-pool-lifecycle'

/** Renderer-side relay handle; the actual ManagedRelay lives in the main process. */
export class ElectronRelay implements IRelay {
  publishTimeout = 10_000

  constructor(
    readonly url: string,
    private readonly bridge: TElectronBridge,
    private readonly listeners: Map<string, TSubHandlers>,
    private readonly publishStarts: Map<string, (at: number) => void>
  ) {}

  async publish(event: NEvent, onstart?: (at: number) => void): Promise<void> {
    const operationId = crypto.randomUUID()
    if (onstart) this.publishStarts.set(operationId, onstart)
    try {
      await this.bridge.relay.publish(this.url, event, this.publishTimeout, operationId)
    } catch (error) {
      // Electron wraps invoke failures; preserve the relay reason for AUTH retry.
      if (error instanceof Error) {
        throw new Error(
          error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
        )
      }
      throw error
    } finally {
      this.publishStarts.delete(operationId)
    }
  }

  async auth(_signFn: TSignAuthEvent): Promise<void> {
    // In Electron mode, signing is triggered by the main process via an
    // auth-request IPC message handled at the pool level; the signer
    // callback argument is ignored here.
    await this.bridge.relay.auth(this.url)
  }

  subscribe(filters: Filter[], handlers: TSubHandlers): TSubCloser {
    const subId = crypto.randomUUID()
    this.listeners.set(subId, handlers)
    // Fire and forget — errors surface via onclose
    this.bridge.relay.subscribe(subId, this.url, filters).catch((err) => {
      const reason = err instanceof Error ? err.message : String(err)
      handlers.onclose?.(reason)
      this.listeners.delete(subId)
    })
    return {
      close: () => {
        this.listeners.delete(subId)
        this.bridge.relay.closeSub(subId).catch(() => {
          // ignore
        })
      }
    }
  }
}

export class ElectronPool implements IRelayPool {
  trackRelays = true

  private seenOn = new BoundedMap<string, Set<IRelay>>({ maxSize: 100_000 })
  private relays = new BoundedMap<string, ElectronRelay>({ maxSize: 1_000 })
  private listeners = new Map<string, TSubHandlers>()
  private publishStarts = new Map<string, (at: number) => void>()
  private bridge: TElectronBridge
  private getSigner: () => TSignAuthEvent | undefined

  constructor(getSigner: () => TSignAuthEvent | undefined) {
    const bridge = getElectronBridge()
    if (!bridge) {
      throw new Error('Electron bridge is not available')
    }

    this.bridge = bridge
    this.getSigner = getSigner

    bridge.relay.onObservation((observation) => {
      switch (observation.type) {
        case 'connection':
          relayObservations.record(observation)
          break
        case 'request-start':
          this.listeners.get(observation.subId)?.onrequest?.(observation.at)
          break
        case 'read-data':
          this.listeners.get(observation.subId)?.ondata?.(observation.at)
          break
        case 'read-timeout':
          this.listeners.get(observation.subId)?.ontimeout?.()
          break
        case 'publish-start':
          this.publishStarts.get(observation.operationId)?.(observation.at)
          break
      }
    })

    bridge.relay.onSubEvent(({ subId, event, relayUrl }) => {
      const handlers = this.listeners.get(subId)
      if (!handlers) return
      handlers.receivedEvent?.(this.getOrCreateRelay(relayUrl), event.id)
      if (handlers.alreadyHaveEvent?.(event.id)) return
      handlers.onevent?.(event)
    })

    bridge.relay.onSubEose(({ subId }) => {
      this.listeners.get(subId)?.oneose?.()
    })

    bridge.relay.onSubClose(({ subId, reason }) => {
      const handlers = this.listeners.get(subId)
      this.listeners.delete(subId)
      handlers?.onclose?.(reason)
    })

    bridge.relay.onAuthRequest(async ({ requestId, authEvent }) => {
      const signer = this.getSigner()
      if (!signer) {
        bridge.relay.sendAuthResponse({ requestId, error: 'not logged in' })
        return
      }
      try {
        const signed = await signer(authEvent)
        bridge.relay.sendAuthResponse({ requestId, signedEvent: signed })
      } catch (err) {
        bridge.relay.sendAuthResponse({
          requestId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    })

    observeRelayPoolLifecycle(this)
  }

  async ensureRelay(url: string): Promise<IRelay> {
    return this.getOrCreateRelay(url)
  }

  getRelay(url: string): IRelay {
    return this.getOrCreateRelay(url)
  }

  async checkRelays(): Promise<void> {
    await this.bridge.relay.checkRelays()
  }

  setNetworkOnline(online: boolean): Promise<void> {
    return this.bridge.relay.setNetworkOnline(online)
  }

  close(urls: string[]) {
    this.bridge.relay.close(urls).catch(() => {
      // ignore
    })
  }

  setAllowInsecure(allow: boolean) {
    this.bridge.relay.setAllowInsecure(allow).catch(() => {
      // ignore
    })
  }

  setTrustedInsecureRelayUrls(urls: string[]) {
    this.bridge.relay.setTrustedInsecureRelayUrls(urls).catch(() => {
      // ignore
    })
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

  private getOrCreateRelay(url: string): ElectronRelay {
    url = normalizeUrl(url)
    let r = this.relays.get(url)
    if (!r) {
      r = new ElectronRelay(url, this.bridge, this.listeners, this.publishStarts)
      this.relays.set(url, r)
    }
    return r
  }
}
