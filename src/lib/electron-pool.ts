import type { EventTemplate, Filter, Event as NEvent, VerifiedEvent } from 'nostr-tools'
import type { TElectronBridge } from '../../electron/shared/ipc-types'

type SubHandlers = {
  receivedEvent?: (relay: ElectronRelay, id: string) => void
  alreadyHaveEvent?: (id: string) => boolean
  onevent?: (evt: NEvent) => void
  oneose?: () => void
  onclose?: (reason: string) => void
  eoseTimeout?: number
}

export class ElectronRelay {
  publishTimeout = 10_000

  constructor(
    readonly url: string,
    private readonly bridge: TElectronBridge,
    private readonly listeners: Map<string, SubHandlers>
  ) {}

  // Satisfies AbstractRelay-like shape used by ClientService
  get connected(): boolean {
    return true
  }

  async publish(event: NEvent): Promise<void> {
    return this.bridge.relay.publish(this.url, event, this.publishTimeout)
  }

  async auth(
    _signFn: (authEvt: EventTemplate) => Promise<VerifiedEvent>
  ): Promise<void> {
    // In Electron mode, signing is triggered by the main process via an
    // auth-request IPC message handled at the pool level; the signer
    // callback argument is ignored here.
    await this.bridge.relay.auth(this.url)
  }

  subscribe(filters: Filter[], handlers: SubHandlers): { close: () => void } {
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

export type TSignAuthEvent = (authEvt: EventTemplate) => Promise<VerifiedEvent>

export class ElectronPool {
  // API surface used by ClientService: trackRelays, seenOn, ensureRelay, close
  trackRelays = true
  seenOn = new Map<string, Set<ElectronRelay>>()

  private relays = new Map<string, ElectronRelay>()
  private listeners = new Map<string, SubHandlers>()
  private bridge: TElectronBridge
  private getSigner: () => TSignAuthEvent | undefined

  constructor(bridge: TElectronBridge, getSigner: () => TSignAuthEvent | undefined) {
    this.bridge = bridge
    this.getSigner = getSigner

    bridge.relay.onSubEvent(({ subId, event, relayUrl }) => {
      const handlers = this.listeners.get(subId)
      if (!handlers) return
      const relay = this.getOrCreateRelay(relayUrl)
      handlers.receivedEvent?.(relay, event.id)
      if (handlers.alreadyHaveEvent?.(event.id)) return
      // Track seenOn so ClientService.getSeenEventRelays keeps working
      let set = this.seenOn.get(event.id)
      if (!set) {
        set = new Set()
        this.seenOn.set(event.id, set)
      }
      set.add(relay)
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

  async ensureRelay(url: string): Promise<ElectronRelay> {
    const result = await this.bridge.relay.ensure(url)
    if (!result.ok) {
      throw new Error(result.error || `failed to ensure relay ${url}`)
    }
    return this.getOrCreateRelay(url)
  }

  close(urls?: string[]) {
    this.bridge.relay.close(urls).catch(() => {
      // ignore
    })
  }

  setAllowInsecure(allow: boolean) {
    this.bridge.relay.setAllowInsecure(allow).catch(() => {
      // ignore
    })
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
