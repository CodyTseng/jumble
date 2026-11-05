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
  constructor(private readonly managedPool: IRelayPool) {
    super({ verifyEvent, maxWaitForConnection: 10_000 })
  }

  override subscribe(urls: string[], filter: Filter, params: SubscribeManyParams) {
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
      onAllClose: () => params.onclose?.(reasons),
      getAuthenticator: () =>
        onauth ? (relay) => relay.auth(onauth).then(() => undefined) : undefined
    })

    const abort = () => sub.close(String(params.abort?.reason ?? 'aborted'))
    if (params.abort?.aborted) abort()
    else params.abort?.addEventListener('abort', abort, { once: true })

    return {
      close: (reason?: string) => {
        params.abort?.removeEventListener('abort', abort)
        sub.close(reason)
      }
    }
  }

  override publish(urls: string[], event: Event): Promise<string>[] {
    return Array.from(new Set(urls.map(normalizeUrl)), async (url) => {
      const relay = await this.managedPool.ensureRelay(url)
      const result = await relay.publish(event)
      return typeof result === 'string' ? result : ''
    })
  }
}
