import { app, type BrowserWindow } from 'electron'
import type { Event as NEvent, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { SmartPool, type SmartPoolOptions } from '../../src/lib/smart-pool'
import {
  IPC_CHANNELS,
  TRelayTransportObservation,
  TAuthRequestPayload,
  TAuthResponsePayload,
  TSubClosePayload,
  TSubEosePayload,
  TSubEventPayload
} from '../shared/ipc-types.js'

type SubCloser = { close: () => void }

const DEFAULT_PUBLISH_TIMEOUT = 10_000
const USER_AGENT = `Jumble/${app.getVersion()} (Desktop; Electron)`

class ElectronWebSocket extends WebSocket {
  constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols, {
      headers: {
        'User-Agent': USER_AGENT
      }
    })

    // nostr-tools clears onerror immediately after closing a connecting socket,
    // but ws emits that error asynchronously. Keep a listener so it does not
    // become an uncaught exception in the Electron main process.
    this.on('error', () => {})
  }
}

export class RelayManager {
  // ws implements the WebSocket surface nostr-tools uses, but its Node types
  // intentionally do not include the browser-only EventTarget methods.
  private pool = new SmartPool({
    observe: (observation) => this.sendToRenderer(IPC_CHANNELS.observation, observation),
    websocketImplementation:
      ElectronWebSocket as unknown as SmartPoolOptions['websocketImplementation']
  })
  private subs = new Map<string, SubCloser>()
  private pendingAuthRequests = new Map<
    string,
    { resolve: (evt: VerifiedEvent) => void; reject: (err: Error) => void }
  >()
  private window: BrowserWindow | null = null

  attachWindow(win: BrowserWindow) {
    this.window = win
  }

  setAllowInsecure(allow: boolean) {
    this.pool.setAllowInsecure(allow)
  }

  setTrustedInsecureRelayUrls(urls: string[]) {
    this.pool.setTrustedInsecureRelayUrls(urls)
  }

  async checkRelays() {
    await this.pool.checkRelays()
  }

  setNetworkOnline(online: boolean) {
    this.pool.setNetworkOnline(online)
  }

  async publish(
    url: string,
    event: NEvent,
    timeoutMs: number = DEFAULT_PUBLISH_TIMEOUT,
    operationId?: string
  ) {
    const relay = this.pool.getRelay(url)
    relay.publishTimeout = timeoutMs
    await relay.publish(event, (at) => {
      if (operationId)
        this.sendToRenderer<TRelayTransportObservation>(IPC_CHANNELS.observation, {
          type: 'publish-start',
          operationId,
          at
        })
    })
  }

  subscribe(subId: string, url: string, filters: Filter[]) {
    if (this.subs.has(subId)) return
    const known = new Set<string>()
    let firstData = false
    const sub = this.pool.getRelay(url).subscribe(filters, {
      ondata: (at = Date.now()) => {
        if (firstData) return
        firstData = true
        this.sendToRenderer<TRelayTransportObservation>(IPC_CHANNELS.observation, {
          type: 'read-data',
          subId,
          at
        })
      },
      onrequest: (at) =>
        this.sendToRenderer<TRelayTransportObservation>(IPC_CHANNELS.observation, {
          type: 'request-start',
          subId,
          at
        }),
      ontimeout: () =>
        this.sendToRenderer<TRelayTransportObservation>(IPC_CHANNELS.observation, {
          type: 'read-timeout',
          subId
        }),
      alreadyHaveEvent: (id: string) => {
        if (known.has(id)) return true
        known.add(id)
        return false
      },
      onevent: (evt: NEvent) => {
        this.sendToRenderer<TSubEventPayload>(IPC_CHANNELS.subEvent, {
          subId,
          event: evt,
          relayUrl: url
        })
      },
      oneose: () => {
        firstData = true
        this.sendToRenderer<TSubEosePayload>(IPC_CHANNELS.subEose, { subId })
      },
      onclose: (reason: string) => {
        this.sendToRenderer<TSubClosePayload>(IPC_CHANNELS.subClose, { subId, reason })
        this.subs.delete(subId)
      },
      eoseTimeout: 10_000
    })
    this.subs.set(subId, sub)
  }

  closeSub(subId: string) {
    const sub = this.subs.get(subId)
    if (!sub) return
    try {
      sub.close()
    } catch {
      // ignore
    }
    this.subs.delete(subId)
  }

  async auth(url: string) {
    const relay = this.pool.getRelay(url)
    await relay.auth((authEvt: EventTemplate) => this.requestSignatureFromRenderer(url, authEvt))
  }

  close(urls?: string[]) {
    if (urls && urls.length > 0) {
      this.pool.close(urls)
    }
  }

  handleAuthResponse(payload: TAuthResponsePayload) {
    const pending = this.pendingAuthRequests.get(payload.requestId)
    if (!pending) return
    this.pendingAuthRequests.delete(payload.requestId)
    if (payload.error || !payload.signedEvent) {
      pending.reject(new Error(payload.error || 'auth sign failed'))
    } else {
      pending.resolve(payload.signedEvent)
    }
  }

  shutdown() {
    this.subs.forEach((s) => {
      try {
        s.close()
      } catch {
        // ignore
      }
    })
    this.subs.clear()
    this.pendingAuthRequests.forEach((p) => p.reject(new Error('shutdown')))
    this.pendingAuthRequests.clear()
  }

  private requestSignatureFromRenderer(
    url: string,
    authEvent: EventTemplate
  ): Promise<VerifiedEvent> {
    return new Promise((resolve, reject) => {
      if (!this.window || this.window.isDestroyed()) {
        reject(new Error('no renderer window to sign auth'))
        return
      }
      const requestId = randomUUID()
      const timer = setTimeout(() => {
        if (this.pendingAuthRequests.has(requestId)) {
          this.pendingAuthRequests.delete(requestId)
          reject(new Error('auth sign timeout'))
        }
      }, 30_000)
      this.pendingAuthRequests.set(requestId, {
        resolve: (evt) => {
          clearTimeout(timer)
          resolve(evt)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        }
      })
      this.sendToRenderer<TAuthRequestPayload>(IPC_CHANNELS.authRequest, {
        requestId,
        url,
        authEvent
      })
    })
  }

  private sendToRenderer<T>(channel: string, payload: T) {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send(channel, payload)
  }
}
