import { SIGNING_REQUEST_TIMEOUT_MS, signingRequest } from '@/lib/napplet/signing'
import { z } from 'zod'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { RelayPool } from '@/lib/napplet/relay'
import { redactDiagnostic } from '../../diagnostics/src'
import type { SignedEvent } from '../../protocol/src'
import { outboxPublishOptions } from '../../nostr/src/outbox-routing'
import { signExact, type ActionConsent } from './action-session'
import type { HostSign } from './action-contracts'

export type OutboxPublicationPlan = (
  pubkey: string,
  options: unknown,
  signal: AbortSignal
) => Promise<string[]>
export type OutboxPublishIO = {
  publish(relay: string, event: SignedEvent, signal: AbortSignal): Promise<void>
}
const templateSchema = z
  .object({
    kind: z.number().int().min(0).max(65535),
    content: z.string().max(65536),
    tags: z.array(z.array(z.string().max(4096)).max(16)).max(256),
    created_at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
  })
  .strict()
const safeCause = (error: unknown) =>
  redactDiagnostic(error instanceof Error ? error.message : 'Relay transport failed.', 400)

/** Jumble relay transport, with a cancellable subscription and at most one retry of identical bytes. */
export class OutboxPublisher implements OutboxPublishIO {
  private pool = new RelayPool()
  private lifetime = new AbortController()
  constructor(private acknowledgementTimeoutMs = 5000) {}
  close() {
    this.lifetime.abort()
    this.pool.close()
  }
  async publish(relay: string, event: SignedEvent, signal: AbortSignal) {
    signal = AbortSignal.any([signal, this.lifetime.signal])
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted()
      try {
        let subscription: import('rxjs').Subscription | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        let abort = () => {}
        try {
          await new Promise<void>((resolve, reject) => {
            abort = () => reject(new Error('Publication cancelled.'))
            timer = setTimeout(
              () => reject(new Error('Relay acknowledgement timed out.')),
              this.acknowledgementTimeoutMs
            )
            signal.addEventListener('abort', abort, { once: true })
            subscription = this.pool
              .relay(relay)
              .event(event)
              .subscribe({
                next: (response) =>
                  response.ok
                    ? resolve()
                    : reject(
                        new Error(
                          `Relay rejected event: ${redactDiagnostic(response.message ?? 'No reason supplied', 400)}`
                        )
                      ),
                error: reject
              })
            if (signal.aborted) abort()
          })
        } finally {
          clearTimeout(timer)
          signal.removeEventListener('abort', abort)
          subscription?.unsubscribe()
        }
        return
      } catch (error) {
        signal.throwIfAborted()
        if (attempt >= 1 || String(error).includes('Relay rejected event:')) throw error
      }
    }
  }
}

/** Per-frame session: consent and exact signing never escape this host boundary. */
export class NappletOutbox {
  private lifetime = new AbortController()
  private requests = new Map<
    string,
    { fingerprint: string; result: Promise<Record<string, unknown>> }
  >()
  private publisher = new OutboxPublisher()
  private busy = false
  private retainedBytes = 0
  constructor(
    private options: {
      pubkey: string | null
      sign?: HostSign
      signal: AbortSignal
      consent: ActionConsent
      plan: OutboxPublicationPlan
      io?: OutboxPublishIO
      onPublished?: (event: SignedEvent) => void
      requestTimeoutMs?: number
    }
  ) {}
  close() {
    this.lifetime.abort()
    this.publisher.close()
    this.requests.clear()
    this.retainedBytes = 0
  }
  handle(message: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.lifetime.signal.aborted || this.options.signal.aborted)
      return Promise.resolve({
        ok: false,
        error: 'publish-cancelled: reopen the player or reconnect the selected identity.'
      })
    const id = typeof message.id === 'string' ? message.id : ''
    if (!id || id.length > 256) return Promise.resolve({ ok: false, error: 'invalid-request-id' })
    const encoded = new TextEncoder().encode(JSON.stringify([message.event, message.options]))
    if (encoded.length > 132096)
      return Promise.resolve({
        ok: false,
        error: 'policy-denied: publication request exceeds 129 KiB.'
      })
    const fingerprint = bytesToHex(sha256(encoded))
    const previous = this.requests.get(id)
    if (previous)
      return previous.fingerprint === fingerprint
        ? previous.result
        : Promise.resolve({
            ok: false,
            error: 'request-id-reused: use a fresh request ID for a different publication.'
          })
    // Never evict completed IDs and accidentally sign a replay twice during a frame lifetime.
    // Reserve signed result, eventId, outcomes and bounded errors alongside the hash.
    const reservation = encoded.length * 2 + 8192
    if (this.requests.size >= 256 || this.retainedBytes + reservation > 16 * 1024 * 1024)
      return Promise.resolve({
        ok: false,
        error: 'publication-limit: reopen the player before making more publication requests.'
      })
    this.retainedBytes += reservation
    const result = this.run(message)
    this.requests.set(id, { fingerprint, result })
    return result
  }
  private async run(message: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.options.pubkey || !this.options.sign)
      return { ok: false, error: 'not-signed-in: connect a signing viewer account.' }
    if (this.busy)
      return { ok: false, error: 'publish-busy: finish the pending publication first.' }
    this.busy = true
    const signal = AbortSignal.any([
      this.options.signal,
      this.lifetime.signal,
      AbortSignal.timeout(this.options.requestTimeoutMs ?? SIGNING_REQUEST_TIMEOUT_MS)
    ])
    let event: SignedEvent | undefined
    const relays: Record<string, boolean> = {}
    let abort: () => void = () => {}
    try {
      return await Promise.race([
        new Promise<Record<string, unknown>>((resolve) => {
          abort = () =>
            resolve({
              ok: false,
              error:
                'publish-cancelled: account, player or request lifetime changed. Check relay state before retrying.',
              ...(event ? { event, eventId: event.id, relays: { ...relays } } : {})
            })
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) abort()
        }),
        (async () => {
          signal.throwIfAborted()
          const template = templateSchema.parse(message.event)
          // Jumble does not accept app-supplied private-message envelopes or ciphertext.
          if ([4, 13, 14, 1059, 21059].includes(template.kind))
            throw new Error('policy-denied: encrypted messages require shell-mediated encryption.')
          const projected = {
            ...template,
            id: '0'.repeat(64),
            pubkey: this.options.pubkey!,
            sig: '0'.repeat(128)
          }
          if (new TextEncoder().encode(JSON.stringify(projected)).length > 65536)
            throw new Error(
              'policy-denied: signed event would exceed 64 KiB. Shorten content or tags before requesting publication.'
            )
          if ([30078, 35858, 5].includes(template.kind))
            throw new Error(
              'policy-denied: app-data, map and deletion events require their specialized schema, ownership and revision checks.'
            )
          const settings = outboxPublishOptions.parse(message.options ?? {})
          const destinations = [
            ...new Set(await this.options.plan(this.options.pubkey!, settings, signal))
          ]
          signal.throwIfAborted()
          if (!destinations.length || destinations.length > 8)
            throw new Error(
              'policy-denied: publication requires one to eight complete destinations.'
            )
          for (const relay of destinations) relays[relay] = false
          if (
            !(await this.options.consent(
              `Publish Nostr event kind ${template.kind}\nSigned by ${this.options.pubkey}\n\nContent:\n${template.content}\n\nTags:\n${JSON.stringify(template.tags)}\n\nPublic on:\n${destinations.join('\n')}`,
              signal,
              signingRequest(this.options.pubkey!, template, destinations)
            ))
          )
            throw new Error('user-denied: event was not signed or published.')
          signal.throwIfAborted()
          event = await signExact(this.options.sign!, this.options.pubkey!, template, signal)
          signal.throwIfAborted()
          this.options.onPublished?.(event)
          const signed = event
          const errors: string[] = []
          await Promise.all(
            destinations.map(async (relay) => {
              try {
                signal.throwIfAborted()
                await (this.options.io ?? this.publisher).publish(relay, signed, signal)
                signal.throwIfAborted()
                relays[relay] = true
              } catch (error) {
                errors.push(`${relay}: ${safeCause(error)}`)
              }
            })
          )
          signal.throwIfAborted()
          return {
            ok: errors.length === 0,
            event,
            eventId: event.id,
            relays,
            ...(errors.length
              ? {
                  error: `publish-incomplete: ${errors.join('; ')} Retry delivery of this same signed event; some relays may already store it.`
                }
              : {})
          }
        })().catch((error) => ({
          ok: false,
          error:
            error instanceof z.ZodError
              ? 'invalid-event-or-options: supply a bounded unsigned Nostr template and valid routing options.'
              : safeCause(error),
          ...(event ? { event, eventId: event.id, relays } : {})
        }))
      ])
    } finally {
      signal.removeEventListener('abort', abort)
      this.busy = false
    }
  }
}
