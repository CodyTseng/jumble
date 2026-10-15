import { RelayPool } from '@/lib/napplet/relay'
import { matchFilters, type Filter } from 'nostr-tools'
import { take, takeUntil, takeWhile, timer } from 'rxjs'
import { verifiedEvent, type SignedEvent } from '../../protocol/src'
import { readRelayUrl } from '../../nostr/src/relay-policy'
import { redactDiagnostic } from '../../diagnostics/src'

/** A signer-free NAP adapter over Jumble’s relay transport; all wire events are verified. */
export class ProtocolClient {
  private lifetime = new AbortController()
  private connections = new Map<
    string,
    { pool: RelayPool; users: number; timer?: ReturnType<typeof setTimeout> }
  >()
  private connection(url: string) {
    this.lifetime.signal.throwIfAborted()
    let entry = this.connections.get(url)
    if (!entry) {
      if (this.connections.size >= 24) {
        const idle = [...this.connections].find(([, e]) => !e.users)
        if (!idle) throw new Error('Relay connections are busy. Retry shortly.')
        clearTimeout(idle[1].timer)
        idle[1].pool.close()
        this.connections.delete(idle[0])
      }
      entry = { pool: new RelayPool(), users: 0 }
      this.connections.set(url, entry)
    }
    clearTimeout(entry.timer)
    entry.users++
    const current = entry
    return {
      pool: current.pool,
      release: () => {
        if (--current.users || this.connections.get(url) !== current) return
        current.timer = setTimeout(() => {
          current.pool.close()
          this.connections.delete(url)
        }, 10000)
        ;(current.timer as any).unref?.()
      }
    }
  }
  close() {
    this.lifetime.abort()
    for (const entry of this.connections.values()) {
      clearTimeout(entry.timer)
      entry.pool.close()
    }
    this.connections.clear()
  }
  constructor(
    readonly relays: () => string[],
    readonly allowed: (event: SignedEvent) => boolean = () => true
  ) {}
  async query(
    filters: Filter[],
    hints: string[] = [],
    signal = AbortSignal.timeout(10000),
    onEvent?: (event: SignedEvent) => void,
    requireComplete = false,
    onRelayComplete?: () => void
  ) {
    signal = AbortSignal.any([signal, this.lifetime.signal])
    signal.throwIfAborted()
    const relays = [...new Set([...hints, ...this.relays()])]
      .flatMap((value) => {
        try {
          return [readRelayUrl(value, this.relays(), true)]
        } catch {
          return []
        }
      })
      .slice(0, 8)
    const found = new Map<string, SignedEvent>()
    let completed = 0
    await Promise.all(
      relays.map(async (relay) => {
        let connection: ReturnType<ProtocolClient['connection']> | undefined
        try {
          connection = this.connection(relay)
          const pool = connection.pool
          await new Promise<void>((resolve) => {
            if (signal.aborted) {
              resolve()
              return
            }
            const subscription = pool
              .req([relay], filters, { reconnect: false, waitForAuth: false })
              .pipe(
                takeWhile((m) => m.type !== 'EOSE' && m.type !== 'CLOSED', true),
                take(1200),
                takeUntil(timer(3500))
              )
              .subscribe({
                next: (m) => {
                  if (m.type === 'EOSE') {
                    completed++
                    onRelayComplete?.()
                  }
                  if (m.type !== 'EVENT' || found.size >= 1000) return
                  try {
                    if (JSON.stringify(m.event).length > 70000) return
                    const event = verifiedEvent(m.event)
                    if (
                      event.created_at <= Date.now() / 1000 + 60 &&
                      matchFilters(filters, event)
                    ) {
                      const fresh = !found.has(event.id)
                      found.set(event.id, event)
                      if (fresh) onEvent?.(event)
                    }
                  } catch {
                    /* Ignore invalid optional input. */
                  }
                },
                error: () => resolve(),
                complete: resolve
              })
            const abort = () => {
              subscription.unsubscribe()
              resolve()
            }
            signal.addEventListener('abort', abort, { once: true })
            subscription.add(() => signal.removeEventListener('abort', abort))
          })
        } finally {
          connection?.release()
        }
      })
    )
    signal.throwIfAborted()
    if (requireComplete && (!relays.length || completed !== relays.length))
      throw new Error('list-unavailable')
    if (!completed && !found.size)
      throw new Error('No relay completed the query. Check your relay settings or retry.')
    return [...found.values()]
  }
  /** A partial read for interactive UI. Other relays still populate the verified store.
   * Never use this for mutations requiring a complete relay view. */
  queryAvailable(filters: Filter[], hints: string[] = [], signal?: AbortSignal) {
    return new Promise<SignedEvent[]>((resolve, reject) => {
      const found = new Map<string, SignedEvent>()
      const finish = () => resolve([...found.values()])
      void this.query(
        filters,
        hints,
        signal,
        (event) => found.set(event.id, event),
        false,
        finish
      ).then(finish, reject)
    })
  }
  async publish(input: SignedEvent, hints: string[] = [], signal?: AbortSignal) {
    signal = AbortSignal.any([...(signal ? [signal] : []), this.lifetime.signal])
    signal.throwIfAborted()
    const event = verifiedEvent(input)
    if (!this.allowed(event)) throw new Error('This action is unavailable here.')
    const relays = [...new Set([...this.relays(), ...hints])]
      .flatMap((value) => {
        try {
          return [readRelayUrl(value, this.relays(), true)]
        } catch {
          return []
        }
      })
      .slice(0, 8)
    const failures: { from: string; message: string }[] = []
    // Fan out once, but acceptance by one relay is enough to finish the action.
    // The remaining bounded attempts keep running and retain their connections.
    const attempts = relays.map(async (relay) => {
      let connection: ReturnType<ProtocolClient['connection']> | undefined
      try {
        signal?.throwIfAborted()
        connection = this.connection(relay)
        const results = await connection.pool.publish([relay], event, {
          timeout: 6000,
          retries: false
        })
        const accepted = results.filter((r) => r.ok).map((r) => r.from)
        if (accepted.length) return accepted
        throw new Error(results.map((r) => r.message || 'rejected or timed out').join('; '))
      } catch (error) {
        failures.push({
          from: relay,
          message: redactDiagnostic(
            error instanceof Error ? error.message : 'Transport failed',
            200
          )
        })
        throw error
      } finally {
        connection?.release()
      }
    })
    try {
      // Promise.any also handles later rejections after the first acceptance.
      const accepted = await Promise.any(attempts)
      signal?.throwIfAborted()
      return accepted
    } catch {
      signal?.throwIfAborted()
      throw new Error(
        `No relay acknowledged the event. Retry sends the same signed event. ${failures.map((r) => `${redactDiagnostic(r.from, 200)}: ${r.message}`).join('; ')}`
      )
    }
  }
}
