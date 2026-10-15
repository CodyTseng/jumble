import { SIGNING_REQUEST_TIMEOUT_MS, signingRequest } from '@/lib/napplet/signing'
import { OutboxPublisher, type OutboxPublicationPlan } from './outbox-session'
import { z } from 'zod'
import { matchFilters } from 'nostr-tools'
import { ProtocolClient } from '../../client/src/nostr'
import { verifiedEvent, type SignedEvent } from '../../protocol/src'
import { readRelayUrl } from '../../nostr/src/relay-policy'
import { redactDiagnostic } from '../../diagnostics/src'
import { mapTemplate, MAP_KIND } from './map-contract'
export { isMapPublication } from './map-contract'
import { signExact, type ActionConsent, type ActionIO } from './action-session'
import type { HostSign } from './action-contracts'

const locks = new Set<string>()

/** Constrained public records, never arbitrary event signing. Same host in preview/web. */
export class NappletMapPublication {
  private pending = new Map<string, SignedEvent>()
  private bases = new Map<string, string | null>()
  private clients = new Set<ProtocolClient>()
  private busy = false
  private lifetime = new AbortController()
  constructor(
    private options: {
      relays: string[]
      validateBlob?: (
        template: import('./action-contracts').ActionTemplate,
        signal: AbortSignal
      ) => Promise<void>
      pubkey: string | null
      sign?: HostSign
      signal: AbortSignal
      consent: ActionConsent
      io?: ActionIO
      plan?: OutboxPublicationPlan
    }
  ) {}
  close() {
    this.lifetime.abort()
    for (const client of this.clients) client.close()
    this.clients.clear()
    this.pending.clear()
    this.bases.clear()
  }
  async handle(message: Record<string, unknown>) {
    if (!this.options.pubkey || !this.options.sign)
      return { ok: false, error: 'not-signed-in: connect a viewer identity to publish maps.' }
    if (this.busy) return { ok: false, error: 'map-busy: finish the pending publication first.' }
    this.busy = true
    const signal = AbortSignal.any([
      this.options.signal,
      this.lifetime.signal,
      AbortSignal.timeout(SIGNING_REQUEST_TIMEOUT_MS)
    ])
    try {
      return await new Promise<Record<string, unknown>>((resolve) => {
        const abort = () =>
          resolve({
            ok: false,
            error:
              'map-cancelled: identity, player or request lifetime changed. Check the record before retrying.'
          })
        signal.addEventListener('abort', abort, { once: true })
        void this.perform(message, signal)
          .then(resolve, (error) =>
            resolve({
              ok: false,
              error:
                error instanceof z.ZodError
                  ? 'map-invalid-request: only documented native kind-35858 map records and configured relay destinations can be published.'
                  : redactDiagnostic(
                      error instanceof Error ? error.message : 'map-failed: retry the operation.',
                      700
                    )
            })
          )
          .finally(() => signal.removeEventListener('abort', abort))
        if (signal.aborted) abort()
      })
    } finally {
      this.busy = false
    }
  }
  private async perform(message: Record<string, unknown>, signal: AbortSignal) {
    signal.throwIfAborted()
    const record = mapTemplate(message.event, this.options.pubkey!)
    const template = record.template
    const now = Math.floor(Date.now() / 1000)
    if (template.created_at > now + 60 || template.created_at < now - 86400)
      throw new Error('map-invalid-time: check your clock and prepare the change again.')
    if (message.type === 'outbox.publish') {
      const requested = message.options as Record<string, unknown> | undefined
      if (
        !this.options.plan &&
        (requested?.toOutbox !== false ||
          (Array.isArray(requested.toInboxes) && requested.toInboxes.length))
      )
        throw new Error(
          'policy-denied: specialized writes require configured Network destinations. Use toOutbox:false with explicit configured relays and no recipient inboxes; own-outbox or inbox routing cannot bypass schema and conflict checks.'
        )
    }
    const settings = z
      .object({
        relays: z.array(z.string().max(256)).min(1).max(8).optional(),
        toOutbox: z.boolean().optional(),
        toInboxes: z
          .array(z.string().regex(/^[a-f0-9]{64}$/))
          .max(64)
          .optional()
      })
      .strict()
      .parse(message.options ?? {})
    if (settings.toInboxes?.length && (message.type !== 'outbox.publish' || !this.options.plan))
      throw new Error(
        'policy-denied: recipient inbox routing requires the OUTBOX publication planner.'
      )
    const configured = [
      ...new Set(this.options.relays.map((r) => readRelayUrl(r, this.options.relays, true)))
    ]
    const planned =
      message.type === 'outbox.publish' && this.options.plan
        ? await this.options.plan(this.options.pubkey!, message.options ?? {}, signal)
        : undefined
    signal.throwIfAborted()
    const requested = (planned ?? settings.relays)?.map((r) => readRelayUrl(r, configured, true))
    if (requested?.some((r) => !configured.includes(r)))
      throw new Error(
        'map-relay-not-configured: add this relay in host Network settings before publishing there.'
      )
    const relays =
      planned !== undefined || settings.toOutbox === false
        ? (requested ?? [])
        : [...new Set([...configured, ...(requested ?? [])])]
    if (!relays.length)
      throw new Error('map-no-relays: choose at least one public map relay in Network settings.')
    const pubkey = this.options.pubkey!
    const lock = `${pubkey}:${record.identifier}`
    const edit = async () => {
      if (locks.has(lock))
        throw new Error('map-busy: this record is being edited in another player.')
      locks.add(lock)
      const client = new ProtocolClient(() => relays)
      this.clients.add(client)
      const publisher = new OutboxPublisher()
      const io =
        this.options.io ??
        ({
          query: (filters, s, complete) => client.query(filters, [], s, undefined, complete),
          publish: async (event, s) => {
            const results = await Promise.allSettled(
              relays.map((relay) => publisher.publish(relay, event, s))
            )
            const failures = results.flatMap((result, index) =>
              result.status === 'rejected'
                ? [
                    `${relays[index]}: ${redactDiagnostic(result.reason instanceof Error ? result.reason.message : 'Relay transport failed.', 300)}`
                  ]
                : []
            )
            return {
              accepted: relays.filter((_, index) => results[index].status === 'fulfilled'),
              error: failures.length
                ? `Required relay delivery failed: ${failures.join('; ')}`
                : undefined
            }
          }
        } satisfies ActionIO)
      const key = JSON.stringify(template)
      try {
        const read = async () => {
          const filters = [
            { kinds: [MAP_KIND], authors: [pubkey], '#d': [record.identifier], limit: 1 }
          ]
          let events: SignedEvent[]
          try {
            events = await io.query(filters, signal, true)
          } catch {
            signal.throwIfAborted()
            throw new Error(
              'map-read-incomplete: a selected relay did not complete the current-record lookup. Check Network settings and retry; no further write was sent.'
            )
          }
          signal.throwIfAborted()
          return events
            .map(verifiedEvent)
            .filter((e) => matchFilters(filters, e))
            .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0]
        }
        let pending = this.pending.get(key)
        const initial = await read()
        const baseId = this.bases.has(key) ? this.bases.get(key)! : (initial?.id ?? null)
        if (record.targetId) {
          const targets = await io.query(
            [{ ids: [record.targetId], authors: [pubkey], kinds: [MAP_KIND] }],
            signal,
            true
          )
          const target = targets
            .map(verifiedEvent)
            .find(
              (e) =>
                e.id === record.targetId &&
                e.pubkey === pubkey &&
                e.kind === MAP_KIND &&
                e.tags.some((t) => t[0] === 'd' && t[1] === record.identifier)
            )
          if (!target || initial?.id !== target.id)
            throw new Error('map-conflict: deletion must target the verified current owner map.')
        }
        const check = async () => {
          const current = await read()
          if (pending && current?.id === pending.id) return
          if ((current?.id ?? null) !== baseId)
            throw new Error('map-conflict: the map changed. Reload before publishing.')
          if (current && template.created_at <= current.created_at)
            throw new Error('map-invalid-time: the change must be newer than the current map.')
        }
        await check()
        if (
          !(await this.options.consent(
            `${template.kind === 5 ? 'Unpublish' : 'Publish'} map: ${record.title}\n${template.kind === 5 ? 'Old relay copies and Blossom files may survive.' : 'Public map metadata; anyone can read and remix it. ' + (this.options.validateBlob ? 'Linked bytes are validated by this host.' : 'This host admits metadata only; linked map bytes are not validated.')}\n\nSigned by ${pubkey}. Public on:\n${relays.join('\n')}`,
            signal,
            signingRequest(pubkey, template, relays)
          ))
        )
          throw new Error('user-denied: map was not published.')
        signal.throwIfAborted()
        await check()
        if (template.kind === MAP_KIND && this.options.validateBlob)
          await this.options.validateBlob(template, signal)
        signal.throwIfAborted()
        await check()
        if (!pending) {
          pending = await signExact(this.options.sign!, pubkey, template, signal)
          if (this.pending.size >= 16) {
            const oldest = this.pending.keys().next().value!
            this.pending.delete(oldest)
            this.bases.delete(oldest)
          }
          this.pending.set(key, pending)
          this.bases.set(key, baseId)
        }
        await check()
        signal.throwIfAborted()
        let accepted: unknown
        try {
          accepted = await io.publish(pending, signal)
        } catch (error) {
          signal.throwIfAborted()
          throw new Error(
            `map-publish-failed: ${redactDiagnostic(error instanceof Error ? error.message : 'No relay acknowledged the event.', 400)} Retry this same prepared change; keep your local draft.`
          )
        }
        signal.throwIfAborted()
        if (accepted && typeof accepted === 'object' && 'accepted' in accepted) {
          const result = accepted as { accepted: string[]; error?: string }
          return {
            ok: !result.error && relays.every((relay) => result.accepted.includes(relay)),
            event: pending,
            eventId: pending.id,
            relays: Object.fromEntries(
              relays.map((relay) => [relay, result.accepted.includes(relay)])
            ),
            ...(result.error
              ? {
                  error: `map-publish-failed: publish-incomplete: ${result.error} Retry the same prepared change.`
                }
              : {})
          }
        }
        if (Array.isArray(accepted) && relays.some((relay) => !accepted.includes(relay)))
          return {
            ok: false,
            event: pending,
            eventId: pending.id,
            relays: Object.fromEntries(relays.map((relay) => [relay, accepted.includes(relay)])),
            error:
              'map-publish-failed: publish-incomplete: a required relay did not acknowledge. Retry the same prepared change.'
          }
        // Keep a bounded retry entry so a repeat click does not conflict with its own success.
        return {
          ok: true,
          event: pending,
          eventId: pending.id,
          ...(Array.isArray(accepted)
            ? {
                relays: Object.fromEntries(relays.map((relay) => [relay, accepted.includes(relay)]))
              }
            : {})
        }
      } finally {
        locks.delete(lock)
        publisher.close()
        client.close()
        this.clients.delete(client)
      }
    }
    if (typeof navigator !== 'undefined' && navigator.locks)
      return navigator.locks.request(`napplet-map:${lock}`, { ifAvailable: true }, (held) => {
        if (!held) throw new Error('map-busy: this record is being edited in another tab.')
        return edit()
      })
    return edit()
  }
}
