import type { IRelayPool } from '@/types/relay-pool'
import { AbstractSimplePool, type SubscribeManyParams } from 'nostr-tools/abstract-pool'
import type { Event, Filter } from 'nostr-tools'
import { verifyEvent } from './nostr-verifier'
import { subscribeRelays } from './relay-subscription'
import { normalizeUrl } from './url'

/** Bridges the two pool operations used by nostr-tools' BunkerSigner.
 * Connections belong to the application's pool, including lifecycle recovery
 * and Electron IPC. Closing a signer must only close its own subscriptions.
 */
export class Nip46Pool extends AbstractSimplePool {
  private configuredUrls: Set<string>
  private closers = new Set<() => void>()
  private disposed = false

  constructor(
    private readonly managedPool: IRelayPool,
    private readonly permissions?: { urls: string[]; acquire: (urls: string[]) => () => void }
  ) {
    super({ verifyEvent, maxWaitForConnection: 10_000 })
    this.configuredUrls = new Set(permissions?.urls.map(normalizeUrl))
  }

  private acquire(urls: string[]) {
    if (this.disposed) throw new Error('Signer relay transport is closed')
    const release = this.permissions?.acquire(
      urls.map(normalizeUrl).filter((url) => this.configuredUrls.has(url))
    )
    let released = false
    return () => {
      if (released) return
      released = true
      release?.()
    }
  }

  override subscribe(urls: string[], filter: Filter, params: SubscribeManyParams) {
    const release = this.acquire(urls)
    const seen = new Set<string>()
    const reasons: { url: string; reason: string }[] = []
    const onauth = params.onauth
    const sub = subscribeRelays(this.managedPool, urls.map(normalizeUrl), [filter], {
      onevent: params.onevent,
      alreadyHaveEvent: (id) => {
        if (params.alreadyHaveEvent?.(id) || seen.has(id)) return true
        seen.add(id)
        return false
      },
      oneose: (allEosed) => {
        if (allEosed) params.oneose?.()
      },
      onclose: (url, reason) => reasons.push({ url, reason }),
      onAllClose: () => {
        release()
        params.onclose?.(reasons)
      },
      getAuthenticator: () =>
        onauth ? (relay) => relay.auth(onauth).then(() => undefined) : undefined
    })

    const close = (reason?: string) => {
      params.abort?.removeEventListener('abort', abort)
      sub.close(reason)
      release()
      this.closers.delete(close)
    }
    const abort = () => close(String(params.abort?.reason ?? 'aborted'))
    this.closers.add(close)
    if (params.abort?.aborted) abort()
    else params.abort?.addEventListener('abort', abort, { once: true })

    return { close }
  }

  dispose() {
    this.disposed = true
    for (const close of this.closers) close()
    this.closers.clear()
  }

  override publish(urls: string[], event: Event): Promise<string>[] {
    return Array.from(new Set(urls.map(normalizeUrl)), async (url) => {
      const release = this.acquire([url])
      try {
        const relay = await this.managedPool.ensureRelay(url)
        const result = await relay.publish(event)
        return typeof result === 'string' ? result : ''
      } finally {
        release()
      }
    })
  }
}
