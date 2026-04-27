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

export class ElectronRelay implements IRelay {
  publishTimeout = 10_000

  constructor(
    readonly url: string,
    private readonly bridge: TElectronBridge,
    private readonly listeners: Map<string, TSubHandlers>
  ) {}

  get connected(): boolean {
    return true
  }

  async publish(event: NEvent): Promise<void> {
    return this.bridge.relay.publish(this.url, event, this.publishTimeout)
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

  private seenOn = new Map<string, Set<IRelay>>()
  private relays = new Map<string, ElectronRelay>()
  private listeners = new Map<string, TSubHandlers>()
  private bridge: TElectronBridge
  private getSigner: () => TSignAuthEvent | undefined

  constructor(getSigner: () => TSignAuthEvent | undefined) {
    const bridge = getElectronBridge()
    if (!bridge) {
      throw new Error('Electron bridge is not available')
    }

    this.bridge = bridge
    this.getSigner = getSigner

    bridge.relay.onSubEvent(({ subId, event, relayUrl }) => {
      const handlers = this.listeners.get(subId)
      if (!handlers) return
      const relay = this.getOrCreateRelay(relayUrl)
      handlers.receivedEvent?.(relay, event.id)
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
  }

  async ensureRelay(url: string): Promise<IRelay> {
    const result = await this.bridge.relay.ensure(url)
    if (!result.ok) {
      throw new Error(result.error || `failed to ensure relay ${url}`)
    }
    return this.getOrCreateRelay(url)
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
    let r = this.relays.get(url)
    if (!r) {
      r = new ElectronRelay(url, this.bridge, this.listeners)
      this.relays.set(url, r)
    }
    return r
  }
}
