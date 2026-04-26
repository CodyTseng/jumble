import type { BrowserWindow } from 'electron'
import type {
  Event as NEvent,
  EventTemplate,
  Filter,
  VerifiedEvent
} from 'nostr-tools'
import { randomUUID } from 'node:crypto'
import { SmartPool } from '../../src/lib/smart-pool'
import {
  IPC_CHANNELS,
  TAuthRequestPayload,
  TAuthResponsePayload,
  TSubClosePayload,
  TSubEosePayload,
  TSubEventPayload
} from '../shared/ipc-types.js'

type SubCloser = { close: () => void }

const DEFAULT_PUBLISH_TIMEOUT = 10_000

export class RelayManager {
  private allowInsecure = false
  private pool = new SmartPool({ isAllowInsecure: () => this.allowInsecure })
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
    this.allowInsecure = allow
  }

  async ensure(url: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.pool.ensureRelay(url)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async publish(url: string, event: NEvent, timeoutMs: number = DEFAULT_PUBLISH_TIMEOUT) {
    const relay = await this.pool.ensureRelay(url)
    relay.publishTimeout = timeoutMs
    await relay.publish(event)
  }

  async subscribe(subId: string, url: string, filters: Filter[]) {
    if (this.subs.has(subId)) return
    const relay = await this.pool.ensureRelay(url)
    const known = new Set<string>()
    const sub = relay.subscribe(filters, {
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
    const relay = await this.pool.ensureRelay(url)
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
