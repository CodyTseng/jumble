import {
  SIGNING_REQUEST_TIMEOUT_MS,
  signingRequest,
  type NappletSigningRequest
} from '@/lib/napplet/signing'
import { z } from 'zod'
import { type Filter } from 'nostr-tools'
import { verifiedEvent, type SignedEvent } from '../../protocol/src'
import { ProtocolClient } from '../../client/src/nostr'
import { DiagnosticError, redactDiagnostic } from '../../diagnostics/src'
import {
  LIST_SUPPORT,
  listMutationSchema,
  mutateList,
  publicHttp,
  publicKey,
  resolveList,
  type ActionTemplate,
  type HostSign,
  type ListMutation
} from './action-contracts'

export type ActionConsent = (
  description: string,
  signal: AbortSignal,
  signing?: NappletSigningRequest
) => Promise<boolean>
export type ActionIO = {
  query(filters: Filter[], signal: AbortSignal, complete: boolean): Promise<SignedEvent[]>
  publish(event: SignedEvent, signal: AbortSignal): Promise<unknown>
}
export async function signExact(
  sign: HostSign,
  pubkey: string,
  template: ActionTemplate,
  signal: AbortSignal
) {
  signal.throwIfAborted()
  const expected = JSON.stringify({
    kind: template.kind,
    tags: template.tags,
    content: template.content,
    created_at: template.created_at
  })
  let event: SignedEvent
  try {
    event = verifiedEvent(await sign(pubkey, structuredClone(template)))
  } catch (cause) {
    signal.throwIfAborted()
    throw new DiagnosticError(
      'NAP_SIGNER_FAILED',
      `signer-failed: ${redactDiagnostic(cause instanceof Error ? cause.message : 'Signing did not complete.', 400)} Unlock the signer, check its event-kind permissions and retry.`,
      {
        operation: 'Sign approved Nostr event',
        cause,
        recovery: 'Unlock the selected signer and check its permissions before retrying.'
      }
    )
  }
  signal.throwIfAborted()
  if (
    event.pubkey !== pubkey ||
    JSON.stringify({
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      created_at: event.created_at
    }) !== expected
  )
    throw new Error('signer-mismatch')
  return event
}
const hex = z.string().regex(/^[a-f0-9]{64}$/)
const latest = (events: SignedEvent[]) =>
  [...events].sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0]
const locks = new Set<string>()
/** Viewer actions only. Never exposes the signer or arbitrary signing to the frame. */
export class NappletActions {
  private client: ProtocolClient
  private io: ActionIO
  private pending = new Map<string, { event: SignedEvent; baseId?: string }>()
  private busy = false
  constructor(
    private options: {
      pubkey: string | null
      sign?: HostSign
      relays: string[]
      consent: ActionConsent
      signal: AbortSignal
      io?: ActionIO
    }
  ) {
    this.client = new ProtocolClient(() => options.relays)
    this.io = options.io ?? {
      query: (filters, signal, complete) =>
        this.client.query(filters, [], signal, undefined, complete),
      publish: (event, signal) => this.client.publish(event, [], signal)
    }
  }
  close() {
    this.client.close()
    this.pending.clear()
  }
  async handle(message: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (message.type === 'lists.supported') return { lists: LIST_SUPPORT }
    if (!this.options.pubkey || !this.options.sign) return { ok: false, error: 'not-signed-in' }
    if (this.busy) return { ok: false, error: 'busy' }
    this.busy = true
    const signal = AbortSignal.any([
      this.options.signal,
      AbortSignal.timeout(SIGNING_REQUEST_TIMEOUT_MS)
    ])
    try {
      // Leave time for approval and signing, while settling before the shim deadline.
      // Every continuation checks this signal before signing or publishing.
      return await new Promise((resolve) => {
        const abort = () => resolve({ ok: false, error: 'request-cancelled' })
        signal.addEventListener('abort', abort, { once: true })
        void this.perform(message, signal)
          .then(resolve, (error) =>
            resolve({
              ok: false,
              error:
                error instanceof z.ZodError
                  ? 'invalid-item'
                  : error instanceof Error
                    ? error.message
                    : 'action-failed',
              ...(String(error).includes('unsupported-list') ? { supported: LIST_SUPPORT } : {})
            })
          )
          .finally(() => signal.removeEventListener('abort', abort))
        if (signal.aborted) abort()
      })
    } finally {
      this.busy = false
    }
  }
  private async perform(
    message: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    const type = String(message.type),
      pubkey = this.options.pubkey!
    let mutation: ListMutation | undefined
    if (type === 'lists.add' || type === 'lists.remove')
      mutation = listMutationSchema.parse({
        list: message.list,
        items: message.items,
        options: message.options
      })
    if (type === 'common.follow' || type === 'common.unfollow') {
      const keys = z.array(z.string().max(128)).min(1).max(64).parse(message.pubkeys).map(publicKey)
      mutation = {
        list: { kind: 3 },
        items: keys.map((value) => ({ itemType: 'pubkey', value, visibility: 'public' })),
        options: { create: true }
      }
    }
    if (mutation) {
      const support = resolveList(mutation.list)
      const lock = `${pubkey}:${support.kind}:${mutation.list.identifier ?? ''}`
      const edit = async () => {
        if (locks.has(lock)) throw new Error('list-busy')
        locks.add(lock)
        try {
          return await this.editList(message, mutation!, signal)
        } finally {
          locks.delete(lock)
        }
      }
      // Same-origin tabs share this lock when the browser supports Web Locks.
      if (typeof navigator !== 'undefined' && navigator.locks)
        return navigator.locks.request(`napplet-list:${lock}`, { ifAvailable: true }, (held) => {
          if (!held) throw new Error('list-busy')
          return edit()
        })
      return edit()
    }
    let template: Omit<ActionTemplate, 'created_at'>
    if (type === 'common.react') {
      const id = hex.parse(message.targetEventId),
        reaction = z.string().min(1).max(80).parse(message.reaction)
      const shortcode = /^:([a-zA-Z0-9_-]+):$/.exec(reaction)
      const single =
        [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(reaction)].length ===
        1
      if (
        !['+', '-'].includes(reaction) &&
        !shortcode &&
        !(single && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(reaction))
      )
        throw new Error('invalid-reaction')
      if (!!shortcode !== (message.customEmojiHref !== undefined))
        throw new Error('invalid-reaction')
      const target = await this.target(id, signal)
      const tags = [
        ['e', target.id],
        ['p', target.pubkey],
        ['k', String(target.kind)]
      ]
      if (target.kind >= 30000 && target.kind < 40000)
        tags.push([
          'a',
          `${target.kind}:${target.pubkey}:${target.tags.find((t) => t[0] === 'd')?.[1] ?? ''}`
        ])
      if (shortcode)
        tags.push([
          'emoji',
          shortcode[1],
          publicHttp(z.string().max(2048).parse(message.customEmojiHref))
        ])
      template = { kind: 7, content: reaction, tags }
    } else if (type === 'common.report') {
      const target = z
        .discriminatedUnion('type', [
          z
            .object({
              type: z.literal('event'),
              id: hex,
              pubkey: hex.optional(),
              relay: z.string().max(2048).optional()
            })
            .strict(),
          z
            .object({
              type: z.literal('pubkey'),
              pubkey: hex,
              relay: z.string().max(2048).optional()
            })
            .strict()
        ])
        .parse(message.target)
      const reason = z
        .enum(['nudity', 'malware', 'profanity', 'illegal', 'spam', 'impersonation', 'other'])
        .parse(message.reason)
      const content = z.string().max(2000).parse(message.text)
      let tags: string[][]
      if (target.type === 'event') {
        const event = await this.target(target.id, signal)
        if (target.pubkey && event.pubkey !== target.pubkey) throw new Error('invalid-target')
        tags = [
          ['e', event.id, reason],
          ['p', event.pubkey]
        ]
      } else tags = [['p', target.pubkey, reason]]
      template = { kind: 1984, tags, content }
    } else throw new Error('unsupported')
    return this.commit(JSON.stringify(template), template, signal)
  }
  private async target(id: string, signal: AbortSignal) {
    const event = (await this.io.query([{ ids: [id] }], signal, false)).find((e) => e.id === id)
    if (!event) throw new Error('author-unresolved')
    return verifiedEvent(event)
  }
  private async editList(
    message: Record<string, unknown>,
    input: ListMutation,
    signal: AbortSignal
  ) {
    const kind = resolveList(input.list).kind
    const filters: Filter[] = [
      {
        kinds: [kind],
        authors: [this.options.pubkey!],
        ...(input.list.identifier ? { '#d': [input.list.identifier] } : {}),
        limit: 1
      }
    ]
    const read = async () => {
      try {
        return latest(await this.io.query(filters, signal, true))
      } catch {
        signal.throwIfAborted()
        throw new Error('list-unavailable')
      }
    }
    const base = await read()
    const remove = message.type === 'lists.remove' || message.type === 'common.unfollow'
    // Unfollowing an absent list is already satisfied and must not publish an empty replacement.
    if (!base && message.type === 'common.unfollow') return { ok: true }
    const change = mutateList(input, base, remove)
    const counts = { added: change.added, removed: change.removed, skipped: change.skipped }
    if (!change.changed)
      return { ok: true, ...counts, ...(base ? { eventId: base.id, event: base } : {}) }
    const template = { kind, tags: change.tags, content: change.content }
    const key = JSON.stringify({ type: message.type, input })
    const result = await this.commit(
      key,
      template,
      signal,
      base,
      async () => {
        const current = await read()
        if (current?.id !== base?.id) throw new Error('list-changed-retry')
      },
      `${remove ? 'Remove from' : 'Add to'} ${resolveList(input.list).type}${input.list.identifier ? ` (${input.list.identifier})` : ''}:\n${input.items.map((i) => `${i.itemType}: ${i.value}${i.marker ? ` (${i.marker})` : ''}`).join('\n')}`
    )
    return { ...result, ...counts }
  }
  private async commit(
    key: string,
    template: Omit<ActionTemplate, 'created_at'>,
    signal: AbortSignal,
    base?: SignedEvent,
    recheck?: () => Promise<void>,
    description?: string
  ) {
    let pending = this.pending.get(key)
    if (pending?.baseId !== base?.id) {
      this.pending.delete(key)
      pending = undefined
    }
    const now = Math.floor(Date.now() / 1000)
    if (!pending && base && base.created_at >= now) throw new Error('list-changed-retry')
    const approvedTemplate = pending?.event ?? { ...template, created_at: now }
    const label =
      description ??
      `${template.kind === 7 ? 'React' : 'Report'}:\n${template.content}\n${template.tags.map((t) => t.join(' · ')).join('\n')}`
    if (
      !(await this.options.consent(
        `${label}\n\nSigned by ${this.options.pubkey}. Public on:\n${this.options.relays.join('\n')}`,
        signal,
        signingRequest(this.options.pubkey!, approvedTemplate, this.options.relays)
      ))
    )
      throw new Error('user-denied')
    signal.throwIfAborted()
    await recheck?.()
    if (!pending) {
      const event = await signExact(
        this.options.sign!,
        this.options.pubkey!,
        approvedTemplate,
        signal
      )
      pending = { event, baseId: base?.id }
      if (this.pending.size >= 16) this.pending.delete(this.pending.keys().next().value!)
      this.pending.set(key, pending)
    }
    await recheck?.()
    signal.throwIfAborted()
    try {
      await this.io.publish(pending.event, signal)
    } catch {
      throw new Error('publish-failed')
    }
    signal.throwIfAborted()
    this.pending.delete(key)
    return { ok: true, eventId: pending.event.id, event: pending.event }
  }
}
