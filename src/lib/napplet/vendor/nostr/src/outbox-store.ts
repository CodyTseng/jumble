import { matchFilters, type Filter } from 'nostr-tools'
import { catchError, throwError, Observable, Subject, Subscription } from 'rxjs'
import {
  DiagnosticError,
  diagnose,
  formatDiagnostic,
  redactDiagnostic
} from '../../diagnostics/src'
import { verifiedEvent, type SignedEvent } from '../../protocol/src'
import type { PlaybackReadPool } from './playback'
import { readRelayUrl } from './relay-policy'

export type OutboxStoreOptions = {
  maxEvents?: number
  maxBytes?: number
  ttlMs?: number
  timeoutMs?: number
  now?: () => number
}

/** Account-scoped raw transport cache. Cache presence never proves relay coverage. */
export class OutboxEventStore {
  private readonly changes = new Subject<SignedEvent>()
  readonly changes$ = this.changes.asObservable()
  private readonly scope = new Subscription()
  private readonly entries = new Map<
    string,
    { event: SignedEvent; expires: number; bytes: number; relays: Set<string> }
  >()
  private request: (
    urls: string[],
    filters: Filter[],
    timeoutMs?: number,
    completed?: () => void,
    failure?: (error: unknown, targets: string[]) => void
  ) => Observable<SignedEvent>
  private bytes = 0
  private closed = false
  private readonly now: () => number
  private readonly maxEvents: number
  private readonly maxBytes: number
  private readonly ttlMs: number
  private readonly timeoutMs: number

  constructor(
    pool: PlaybackReadPool,
    private readonly relays: string[],
    options: OutboxStoreOptions = {}
  ) {
    this.now = options.now ?? Date.now
    this.maxEvents = options.maxEvents ?? 1024
    this.maxBytes = options.maxBytes ?? 16 * 1024 * 1024
    this.ttlMs = options.ttlMs ?? 60_000
    this.timeoutMs = options.timeoutMs ?? 2000
    if (
      [this.maxEvents, this.maxBytes, this.ttlMs, this.timeoutMs].some(
        (n) => !Number.isSafeInteger(n) || n < 1
      )
    )
      throw new Error('Invalid OUTBOX cache bounds')
    this.request = (
      urls: string[],
      filters: Filter[],
      timeoutMs = this.timeoutMs,
      completed?: () => void,
      failure?: (error: unknown, targets: string[]) => void
    ) =>
      new Observable<SignedEvent>((observer) => {
        if (this.closed) {
          observer.complete()
          return
        }
        let allowed: string[]
        try {
          allowed = [...new Set(urls.map((url) => readRelayUrl(url, this.relays, true)))]
          if (allowed.length > 8) throw new Error('OUTBOX loader relay quota exceeded')
        } catch (error) {
          observer.error(error)
          return
        }
        if (!allowed.length) {
          observer.complete()
          return
        }
        const group = new Subscription()
        this.scope.add(group)
        const ended = new Set<string>()
        const reasons: Error[] = []
        let failed = false,
          count = 0
        const timer = setTimeout(
          () => observer.error(new Error('OUTBOX event load timed out')),
          timeoutMs
        )
        group.add(() => clearTimeout(timer))
        group.add(
          pool.req(allowed, filters, { live: false, timeoutMs }).subscribe({
            next: (message) => {
              if (!allowed.includes(message.from)) return
              if (
                message.type === 'EOSE' ||
                message.type === 'CLOSED' ||
                message.type === 'ERROR'
              ) {
                failed ||= message.type === 'CLOSED' || message.type === 'ERROR'
                if (message.type === 'ERROR' && reasons.length < 8)
                  reasons.push(
                    new DiagnosticError('OUTBOX_RELAY_FAILED', 'Relay request failed.', {
                      target: message.from,
                      cause: (message as { error?: unknown }).error
                    })
                  )
                if (message.type === 'CLOSED' && reasons.length < 8)
                  reasons.push(
                    new Error(
                      `Relay ${redactDiagnostic(message.from, 300)} closed: ${redactDiagnostic(message.reason ?? 'no relay reason supplied', 512)}`
                    )
                  )
                if ((message.type === 'ERROR' || message.type === 'CLOSED') && reasons.length)
                  failure?.(reasons[reasons.length - 1], [message.from])
                ended.add(message.from)
                if (ended.size === allowed.length) {
                  if (failed)
                    observer.error(
                      new AggregateError(
                        reasons,
                        'OUTBOX event load relay closed before completion'
                      )
                    )
                  else {
                    completed?.()
                    observer.complete()
                  }
                }
              } else if (message.type === 'EVENT') {
                try {
                  const event = verifiedEvent(message.event)
                  if (!matchFilters(filters, event)) return
                  const stored = this.ingest(event, message.from)
                  if (stored) observer.next(stored)
                  if (++count >= 2000) observer.error(new Error('OUTBOX event load quota exceeded'))
                } catch {
                  /* Untrusted relay events are discarded before store insertion. */
                }
              }
            },
            error: (error) => observer.error(error),
            complete: () => {
              if (ended.size !== allowed.length)
                observer.error(new Error('OUTBOX event load ended before relay EOSE'))
              else observer.complete()
            }
          })
        )
        return () => {
          group.unsubscribe()
          this.scope.remove(group)
        }
      }).pipe(
        catchError((error) => {
          failure?.(error, urls)
          return throwError(() => error)
        })
      )
  }

  ingest(input: unknown, fromRelay?: string): SignedEvent | undefined {
    if (this.closed) return
    let event: SignedEvent
    try {
      event = verifiedEvent(input)
      if (event.created_at > this.now() / 1000 + 600) return
      if (fromRelay) fromRelay = readRelayUrl(fromRelay, this.relays, true)
    } catch {
      return
    }
    this.prune()
    const bytes = new TextEncoder().encode(JSON.stringify(event)).length
    if (bytes > this.maxBytes) return
    const previous = this.entries.get(event.id)
    const observed = previous?.relays ?? new Set<string>()
    if (fromRelay && observed.size < 8) observed.add(fromRelay)
    if (previous) this.bytes -= previous.bytes
    this.entries.delete(event.id)
    this.entries.set(event.id, {
      event,
      expires: this.now() + this.ttlMs,
      bytes,
      relays: observed
    })
    this.bytes += bytes
    this.prune()
    this.changes.next(event)
    return event
  }

  /** Advisory raw records, including kind 5 and superseded replaceable versions. */
  cached(filters: Filter[]): SignedEvent[] {
    this.prune()
    return [...this.entries.values()]
      .map(({ event }) => event)
      .filter((event) => matchFilters(filters, event))
      .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
  }

  /** Host-only observation metadata. Disclosure into sidecars requires separate policy. */
  observedRelays(id: string): string[] {
    this.prune()
    return [...(this.entries.get(id)?.relays ?? [])]
  }

  /** Read a pinned ID through Jumble’s transport. Only EOSE from every selected
   * relay proves coverage; cached events remain advisory after a failed read. */
  async loadEventWithCoverage(
    id: string,
    trustedRelays: string[],
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<{ events: SignedEvent[]; incomplete: boolean; error?: string }> {
    if (this.closed || signal?.aborted) return { events: [], incomplete: true }
    if (!/^[a-f0-9]{64}$/.test(id) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
      throw new Error('Invalid OUTBOX event load')
    const urls = [...new Set(trustedRelays.map((url) => readRelayUrl(url, this.relays, true)))]
    if (urls.length > 8) throw new Error('OUTBOX loader relay quota exceeded')
    let incomplete = true
    const failures: string[] = []
    const recordFailure = (cause: unknown, targets: string[]) => {
      if (failures.length >= 4) return
      failures.push(
        formatDiagnostic(
          diagnose(
            new DiagnosticError('OUTBOX_READ_FAILED', 'OUTBOX getEvent did not complete.', {
              operation: 'outbox.getEvent',
              target: targets.join(', '),
              cause,
              recovery: 'Check the selected relay availability or access policy and retry.'
            })
          )
        )
      )
    }
    const events = new Map<string, SignedEvent>()
    const group = new Subscription()
    this.scope.add(group)
    const abort = () => {
      recordFailure(new Error('Event load cancelled.'), urls)
      group.unsubscribe()
    }
    try {
      await new Promise<void>((resolve) => {
        // Closing the account must settle the caller as well as close the wire read.
        group.add(resolve)
        signal?.addEventListener('abort', abort, { once: true })
        group.add(() => signal?.removeEventListener('abort', abort))
        if (signal?.aborted || this.closed) {
          abort()
          return
        }
        if (!urls.length) {
          group.unsubscribe()
          return
        }
        group.add(
          this.request(
            urls,
            [{ ids: [id], limit: 1 }],
            timeoutMs,
            () => {
              incomplete = false
            },
            recordFailure
          ).subscribe({
            next: (event) => events.set(event.id, event),
            error: () => group.unsubscribe(),
            complete: () => group.unsubscribe()
          })
        )
      })
      if (!events.size)
        for (const event of this.cached([{ ids: [id] }])) events.set(event.id, event)
      const partial = incomplete || this.closed || !!signal?.aborted
      if (partial && !failures.length)
        recordFailure(
          new Error(
            this.closed
              ? 'Player closed during event load.'
              : 'Selected relays did not complete event load.'
          ),
          urls
        )
      return {
        events: [...events.values()],
        incomplete: partial,
        ...(partial ? { error: redactDiagnostic(failures.join('\n'), 4000) } : {})
      }
    } finally {
      group.unsubscribe()
      this.scope.remove(group)
    }
  }

  private remove(id: string) {
    const entry = this.entries.get(id)
    if (!entry) return
    this.bytes -= entry.bytes
    this.entries.delete(id)
  }
  private prune() {
    for (const [id, entry] of this.entries) if (entry.expires <= this.now()) this.remove(id)
    while (this.entries.size > this.maxEvents || this.bytes > this.maxBytes)
      this.remove(this.entries.keys().next().value!)
  }
  close() {
    if (this.closed) return
    this.closed = true
    this.scope.unsubscribe()
    for (const id of this.entries.keys()) this.remove(id)
    this.changes.complete()
  }
}
