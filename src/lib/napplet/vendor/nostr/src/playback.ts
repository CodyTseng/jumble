import { bech32 } from '@scure/base'
import { RelayPool } from '@/lib/napplet/relay'
import { matchFilters, nip19, type Filter } from 'nostr-tools'
import { defer, NEVER, Subscription, take, takeUntil, timer, type Observable } from 'rxjs'
import { z } from 'zod'
import { verifiedEvent, type SignedEvent } from '../../protocol/src'
import { readRelayUrl } from './relay-policy'
import { OutboxRelayPlanner } from './outbox-routing'
import { OutboxEventStore } from './outbox-store'
import { diagnose, DiagnosticError, formatDiagnostic } from '../../diagnostics/src'
import { APP_DATA_KIND, APP_DATA_PROFILE } from '../../app-data/src/app-data-contract'

const hex = z.string().regex(/^[a-f0-9]{64}$/)
const hexes = z.array(hex).max(64)
const filterSchema = z
  .object({
    ids: hexes.optional(),
    authors: hexes.optional(),
    kinds: z.array(z.number().int().min(0).max(65535)).max(32).optional(),
    since: z.number().int().nonnegative().optional(),
    until: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    search: z.string().max(256).optional()
  })
  .catchall(z.array(z.string().max(256)).max(64))
export function playbackFilters(input: unknown): Filter[] {
  const filters = z
    .array(filterSchema)
    .min(1)
    .max(4)
    .parse(Array.isArray(input) ? input : [input])
  for (const filter of filters)
    for (const key of Object.keys(filter))
      if (
        !['ids', 'authors', 'kinds', 'since', 'until', 'limit', 'search'].includes(key) &&
        !/^#[A-Za-z]$/.test(key)
      )
        throw new Error('Invalid filter')
  return filters
}
type Result = { event: SignedEvent; sidecar?: { relayHints: string[] } }
type Send = (message: Record<string, unknown>) => void
function readFailure(message: string, relays: string[], cause?: unknown) {
  return formatDiagnostic(
    diagnose(
      new DiagnosticError('OUTBOX_READ', message, {
        operation: 'Read Nostr events',
        target: relays.join(', '),
        cause,
        recovery:
          'Check selected relay availability and policy, then retry with a narrower query if needed.'
      })
    )
  ).slice(0, 1800)
}

export type ReadMessage = {
  type: string
  from: string
  event?: unknown
  reason?: string
  error?: unknown
}
export interface PlaybackReadPool {
  req(
    relays: string[],
    filters: Filter[],
    options: { live: boolean; timeoutMs: number }
  ): Observable<ReadMessage>
  close(): void
}
export function directReadPool(pool = new RelayPool()): PlaybackReadPool {
  return {
    req: (relays, filters) => pool.req(relays, filters, { reconnect: false, waitForAuth: false }),
    close: () => pool.close()
  }
}

/** Discovery relays are fallbacks. Public runtime hints are mediated by the host transport. */
export class PlaybackNostr {
  private subscriptions = new Map<string, Subscription>()
  private scope = new Subscription()
  private closeReasons = new Map<string, string>()
  private closedIds = new Set<string>()
  readonly planner: OutboxRelayPlanner
  readonly events: OutboxEventStore
  constructor(
    readonly relays: string[],
    private send: Send,
    private pubkey: () => string | null,
    private pool: PlaybackReadPool = directReadPool(),
    private policy: { discloseRelayHints?: boolean; refreshMs?: number } = {}
  ) {
    this.events = new OutboxEventStore(pool, relays)
    this.planner = new OutboxRelayPlanner(relays, async (authors, timeoutMs, signal) => {
      const result = await this.collect(
        [{ kinds: [10002], authors, limit: 32 }],
        relays,
        timeoutMs,
        signal
      )
      return { events: result.events.map(({ event }) => event), incomplete: result.incomplete }
    })
  }
  close() {
    this.scope.unsubscribe()
    this.planner.close()
    this.events.close()
    this.subscriptions.clear()
    this.pool.close()
  }
  private read(
    filters: Filter[],
    relays: string[],
    callback: (result: Result) => void,
    done: (incomplete: boolean, error?: string) => void,
    live = false,
    timeout = 5000,
    seen = new Set<string>(),
    terminal?: (reason: string) => void,
    backfillLimit = 200,
    backfilled = { count: 0 }
  ) {
    const group = new Subscription(),
      eose = new Set<string>(),
      closedRelays = new Set<string>()
    if (this.scope.closed || !relays.length) {
      queueMicrotask(() => {
        done(
          true,
          readFailure(
            this.scope.closed
              ? 'Player closed or account changed.'
              : 'No policy-allowed relay destinations are available.',
            relays
          )
        )
        if (live)
          terminal?.(
            'No policy-allowed relay destinations are available. Check relay configuration.'
          )
      })
      return group
    }
    const started = Date.now()
    let messages = 0
    let complete = false,
      failed = false,
      backfill = true,
      failureReason = 'Relay subscriptions closed before completing. Retry or select another relay.'
    if (live) {
      const timerId = setTimeout(() => {
        backfill = false
      }, timeout)
      group.add(() => clearTimeout(timerId))
    }
    const finish = (incomplete = true, error?: string) => {
      if (!complete) {
        complete = true
        done(incomplete, error)
      }
    }
    const stream = defer(() => this.pool.req(relays, filters, { live, timeoutMs: timeout }))
      .pipe(take(live ? Infinity : 2000), takeUntil(live ? NEVER : timer(timeout)))
      .subscribe({
        next: (message) => {
          if (!relays.includes(message.from)) return
          messages++
          if (message.type === 'EOSE' || message.type === 'CLOSED' || message.type === 'ERROR') {
            if (message.type === 'CLOSED' || message.type === 'ERROR') {
              failed = true
              closedRelays.add(message.from)
              failureReason =
                message.type === 'ERROR'
                  ? readFailure('Relay request failed.', [message.from], message.error)
                  : readFailure(
                      'Relay closed subscription.',
                      [message.from],
                      message.reason ? new Error(message.reason) : undefined
                    )
            }
            eose.add(message.from)
            if (eose.size >= relays.length) {
              backfill = false
              finish(failed, failed ? failureReason : undefined)
              if (!live || closedRelays.size >= relays.length) {
                group.unsubscribe()
                if (live) terminal?.(failureReason)
              }
            }
          }
          if (message.type !== 'EVENT') return
          try {
            const event = verifiedEvent(message.event)
            if (!matchFilters(filters, event) || event.created_at > Date.now() / 1000 + 600) return
            this.events.ingest(event, message.from)
            if (seen.has(event.id)) {
              if (!live && this.policy.discloseRelayHints)
                callback({ event, sidecar: { relayHints: [message.from] } })
              return
            }
            seen.add(event.id)
            if (live && seen.size > 2048) seen.delete(seen.values().next().value!)
            if (live && backfill && !eose.has(message.from) && backfilled.count++ >= backfillLimit)
              return
            callback({
              event,
              ...(this.policy.discloseRelayHints ? { sidecar: { relayHints: [message.from] } } : {})
            })
            if (!live && seen.size >= 200) {
              finish(
                true,
                readFailure('Verified event quota of 200 reached before relay EOSE.', relays)
              )
              group.unsubscribe()
            }
          } catch {
            /* Ignore invalid optional input. */
          }
        },
        error: (cause) => {
          const error = readFailure('Relay subscription transport failed.', relays, cause)
          finish(true, error)
          group.unsubscribe()
          if (live) terminal?.(error)
        },
        complete: () => {
          const error = failed
            ? failureReason
            : readFailure(
                messages >= 2000
                  ? 'Relay message quota of 2000 reached before EOSE.'
                  : Date.now() - started >= timeout - 5
                    ? 'Relay read timed out before EOSE.'
                    : 'Relay transport ended before all selected relays reached EOSE.',
                relays
              )
          finish(true, error)
          group.unsubscribe()
          if (live) terminal?.(error)
        }
      })
    group.add(stream)
    this.scope.add(group)
    return group
  }
  query(filters: Filter[], relays = this.relays, timeout = 5000): Promise<Result[]> {
    return this.collect(filters, relays, timeout).then((result) => result.events)
  }
  private collect(
    filters: Filter[],
    relays = this.relays,
    timeout = 5000,
    signal?: AbortSignal
  ): Promise<{ events: Result[]; incomplete: boolean; error?: string }> {
    return new Promise((resolve) => {
      const events: Result[] = []
      const index = new Map<string, Result>()
      const sub = this.read(
        filters,
        relays,
        (result) => {
          const previous = index.get(result.event.id)
          if (previous) {
            if (result.sidecar && previous.sidecar)
              previous.sidecar.relayHints = [
                ...new Set([...previous.sidecar.relayHints, ...result.sidecar.relayHints])
              ]
          } else {
            events.push(result)
            index.set(result.event.id, result)
          }
        },
        (incomplete, error) => resolve({ events, incomplete, ...(error ? { error } : {}) }),
        false,
        timeout
      )
      if (signal?.aborted) sub.unsubscribe()
      else if (signal) {
        const abort = () => sub.unsubscribe()
        signal.addEventListener('abort', abort, { once: true })
        sub.add(() => signal.removeEventListener('abort', abort))
      }
      // Closing a player also settles its outstanding requests.
      sub.add(() =>
        resolve({
          events,
          incomplete: true,
          error: readFailure('Read cancelled because the player closed or account changed.', relays)
        })
      )
    })
  }
  async plan(authors: string[], direction = 'read', timeout = 2000) {
    const {
      incomplete: _incomplete,
      limited: _limited,
      ...plan
    } = await this.planner.resolve(
      authors,
      direction === 'read' ? 'author-read' : 'recipient-inbox',
      timeout
    )
    return plan
  }

  async handle(message: Record<string, unknown>) {
    if (!String(message.type).endsWith('.subscribe')) return this.handleMessage(message)
    const subId = z.string().min(1).max(128).parse(message.subId)
    if (this.scope.closed) throw new Error('Player closed')
    if (this.subscriptions.has(subId) || this.subscriptions.size >= 8)
      throw new Error('Subscription quota exceeded')
    const pending = new Subscription()
    this.closedIds.delete(subId)
    this.subscriptions.set(subId, pending)
    this.closeReasons.set(
      subId,
      'Player closed or account changed. Reopen the subscription if needed.'
    )
    this.scope.add(pending)
    pending.add(() => {
      if (this.subscriptions.get(subId) === pending) this.subscriptions.delete(subId)
      this.send({
        type: `${String(message.type).split('.')[0]}.closed`,
        subId,
        reason: this.closeReasons.get(subId) ?? 'Subscription closed'
      })
      this.closeReasons.delete(subId)
      this.closedIds.add(subId)
      while (this.closedIds.size > 128) this.closedIds.delete(this.closedIds.values().next().value!)
    })
    try {
      return await this.handleMessage(message, pending)
    } catch (error) {
      this.closeReasons.set(subId, readFailure('Subscription setup failed.', this.relays, error))
      pending.unsubscribe()
      return {}
    }
  }
  private async handleMessage(message: Record<string, unknown>, pending?: Subscription) {
    const cancellation = new AbortController()
    pending?.add(() => cancellation.abort())
    const type = String(message.type),
      domain = type.split('.')[0]
    if (type.endsWith('.publish') || type.endsWith('.publishEncrypted'))
      throw new Error('Publishing is disabled in this playback client.')
    if (type.endsWith('.close')) {
      const id = z.string().max(128).parse(message.subId)
      if (this.subscriptions.has(id)) {
        this.closeReasons.set(id, 'Closed by napplet.')
        this.subscriptions.get(id)?.unsubscribe()
        this.subscriptions.delete(id)
      } else if (!this.closedIds.has(id)) {
        this.closedIds.add(id)
        while (this.closedIds.size > 128)
          this.closedIds.delete(this.closedIds.values().next().value!)
        this.send({
          type: `${domain}.closed`,
          subId: id,
          reason: 'Subscription already closed or unknown.'
        })
      }
      return {}
    }
    if (type === 'outbox.resolveRelays') {
      const target = z
        .object({
          authors: hexes.optional(),
          pubkey: hex.optional(),
          direction: z.enum(['read', 'write']).optional()
        })
        .strict()
        .parse(message.target)
      return {
        plan: await this.plan(
          target.authors ?? (target.pubkey ? [target.pubkey] : []),
          target.direction
        )
      }
    }
    const filters =
      type === 'outbox.getEvent'
        ? [{ ids: [hex.parse(message.eventId)], limit: 1 }]
        : playbackFilters(message.filters)
    const options = z
      .object({
        authors: hexes.optional(),
        author: hex.optional(),
        relays: z.array(z.string().max(256)).max(8).optional(),
        timeoutMs: z.number().int().min(100).max(10000).optional(),
        limit: z.number().int().min(1).max(200).optional()
      })
      .strict()
      .parse(message.options ?? {})
    // The SDK starts its timer before posting to the host. Its timeout covers
    // discovery, reads AND delivery of our result, not just network activity.
    // Keep a response margin so a slow relay cannot discard already verified
    // events by making our reply race the SDK's rejection.
    const requestTimeout = options.timeoutMs ?? 5000
    const readBudget = requestTimeout - Math.min(1000, Math.max(25, Math.ceil(requestTimeout / 5)))
    const deadline = Date.now() + readBudget
    const hints = (options.relays ?? []).map((r) => readRelayUrl(r, this.relays, true))
    const explicit = message.relay
      ? readRelayUrl(z.string().parse(message.relay), this.relays, true)
      : undefined
    let relays = this.relays
    let incomplete = false
    // These app records live on explicitly chosen storage relays. Unrelated
    // discovery/NIP-65 relays must not make every storage read partial or slow.
    const appStorage =
      domain === 'outbox' &&
      hints.length > 0 &&
      filters.every(
        (f) =>
          f.kinds?.length === 1 &&
          f.kinds[0] === APP_DATA_KIND &&
          (f['#L']?.includes(APP_DATA_PROFILE) ||
            f['#d']?.every((d) => d.startsWith(`${APP_DATA_PROFILE}:`)))
      )
    if (domain === 'outbox' && !explicit && !appStorage) {
      const authors = [
        ...new Set([
          ...(options.authors ?? []),
          ...(options.author ? [options.author] : []),
          ...filters.flatMap((f) => f.authors ?? [])
        ])
      ]
      const plan = await this.planner.resolve(
        authors,
        'author-read',
        Math.min(2000, Math.floor(readBudget / 3)),
        false,
        cancellation.signal
      )
      relays = plan.relays
      // Explicit application/storage relays are a usable read plan even when
      // the author has never published NIP-65 metadata. Actual relay failures
      // still mark the result incomplete below.
      incomplete =
        plan.limited ||
        (plan.incomplete && !(hints.length && plan.missingAuthors.length === authors.length))
    }
    const candidates = [...new Set([...hints, ...relays])]
    if (!explicit && !appStorage && candidates.length > 8) incomplete = true
    relays = explicit ? [explicit] : appStorage ? [...new Set(hints)] : candidates.slice(0, 8)
    if (this.scope.closed) throw new Error('Player closed')
    if (type.endsWith('.subscribe')) {
      const subId = z.string().max(128).parse(message.subId)
      if (!pending || pending.closed) return {}
      const seen = new Set<string>()
      const backfilled = { count: 0 }
      let current: Subscription | undefined
      let previous = ''
      const replace = (next: string[]) => {
        if (pending.closed || JSON.stringify(next) === previous) return
        previous = JSON.stringify(next)
        current?.unsubscribe()
        current = this.read(
          filters,
          next,
          (result) => this.send({ type: `${domain}.event`, subId, result }),
          () => {
            if (domain === 'relay') this.send({ type: 'relay.eose', subId })
          },
          true,
          requestTimeout,
          seen,
          (reason) => {
            this.closeReasons.set(subId, reason)
            pending.unsubscribe()
          },
          options.limit ??
            Math.min(
              200,
              filters.reduce((sum, filter) => sum + (filter.limit ?? 50), 0)
            ),
          backfilled
        )
        pending.add(current)
      }
      replace(relays)
      if (domain === 'outbox' && !explicit && !appStorage) {
        const authors = [
          ...new Set([
            ...(options.authors ?? []),
            ...(options.author ? [options.author] : []),
            ...filters.flatMap((f) => f.authors ?? [])
          ])
        ]
        let refreshing = false
        const refresh = async () => {
          if (pending.closed || refreshing) return
          refreshing = true
          try {
            const plan = await this.planner.resolve(
              authors,
              'author-read',
              Math.min(2000, readBudget),
              true,
              cancellation.signal
            )
            replace([...new Set([...hints, ...plan.relays])].slice(0, 8))
          } catch {
            /* A refresh failure retains the existing policy-checked route. */
          } finally {
            refreshing = false
          }
        }
        const interval = setInterval(() => void refresh(), this.policy.refreshMs ?? 60000)
        pending.add(() => clearInterval(interval))
        pending.add(
          this.events.changes$.subscribe((event) => {
            if (event.kind === 10002 && authors.includes(event.pubkey)) {
              if (!this.planner.observe(event)) return
              void this.planner
                .resolve(
                  authors,
                  'author-read',
                  Math.min(2000, readBudget),
                  false,
                  cancellation.signal
                )
                .then((plan) => replace([...new Set([...hints, ...plan.relays])].slice(0, 8)))
                .catch(() => {})
            }
          })
        )
      }
      return {}
    }
    if (type === 'outbox.getEvent' || type.endsWith('.query')) {
      const collected =
        type === 'outbox.getEvent'
          ? await this.events
              .loadEventWithCoverage(
                String(message.eventId),
                relays,
                Math.max(1, deadline - Date.now()),
                cancellation.signal
              )
              .then((loaded) => ({
                events: loaded.events.map((event) => ({
                  event,
                  ...(this.policy.discloseRelayHints
                    ? { sidecar: { relayHints: this.events.observedRelays(event.id) } }
                    : {})
                })),
                incomplete: loaded.incomplete,
                ...(loaded.error ? { error: loaded.error } : {})
              }))
          : await this.collect(filters, relays, Math.max(1, deadline - Date.now()))
      const maximum =
        options.limit ??
        Math.min(
          200,
          filters.reduce((sum, filter) => sum + (filter.limit ?? 50), 0)
        )
      const events = (
        collected.events.length > maximum
          ? collected.events.sort(
              (a, b) =>
                b.event.created_at - a.event.created_at || a.event.id.localeCompare(b.event.id)
            )
          : collected.events
      ).slice(0, maximum)
      incomplete ||= collected.incomplete
      return type === 'outbox.getEvent'
        ? {
            result: events[0],
            incomplete,
            ...(collected.error
              ? { error: collected.error }
              : collected.incomplete && !events.length
                ? { error: 'Relay read did not complete. Please retry.' }
                : {})
          }
        : {
            events,
            ...(domain === 'outbox' ? { incomplete } : {}),
            ...(collected.error
              ? { error: collected.error }
              : collected.incomplete && !events.length
                ? { error: 'Relay read did not complete. Please retry.' }
                : {})
          }
    }
    throw new Error('Unsupported relay operation')
  }
  async identity(action: string) {
    const pubkey = this.pubkey() ?? ''
    if (action === 'getPublicKey') return { pubkey }
    if (action === 'getRelays') {
      const records = pubkey
        ? await this.query([{ authors: [pubkey], kinds: [10002], limit: 1 }])
        : []
      const latest = records.sort(
        (a, b) => b.event.created_at - a.event.created_at || a.event.id.localeCompare(b.event.id)
      )[0]?.event
      const relays: Record<string, { read: boolean; write: boolean }> = {}
      for (const tag of latest?.tags ?? []) {
        if (tag[0] !== 'r' || (tag[2] && !['read', 'write'].includes(tag[2]))) continue
        try {
          const url = new URL(tag[1])
          if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
            continue
          const previous = relays[url.href]
          relays[url.href] = {
            read: !!previous?.read || tag[2] !== 'write',
            write: !!previous?.write || tag[2] !== 'read'
          }
        } catch {
          /* Ignore invalid optional input. */
        }
      }
      // These are the user's advertised preferences, not permission to contact
      // these servers. plan()/handle() still enforce the host's relay policy.
      return { relays }
    }
    if (action === 'getProfile')
      return { profile: pubkey ? (await this.profile(pubkey)).profile : null }
    if (action === 'getFollows') return { pubkeys: pubkey ? await this.tags(pubkey, 3) : [] }
    if (action === 'getMutes') return { pubkeys: pubkey ? await this.tags(pubkey, 10000) : [] }
    if (action === 'getBlocked')
      throw new Error('Block lists are not supported by the playback policy')
    // These extended list projections are explicitly unavailable, never invented empty successes.
    throw new Error('This identity list is not supported by the playback policy')
  }
  private async tags(pubkey: string, kind: number) {
    const events = await this.query([{ authors: [pubkey], kinds: [kind], limit: 1 }])
    return (
      events
        .sort(
          (a, b) => b.event.created_at - a.event.created_at || a.event.id.localeCompare(b.event.id)
        )[0]
        ?.event.tags.filter((t) => t[0] === 'p' && hex.safeParse(t[1]).success)
        .map((t) => t[1]) ?? []
    )
  }
  async profile(target: string) {
    let pubkey = target
    if (!hex.safeParse(target).success) {
      const decoded = nip19.decode(target)
      if (decoded.type === 'npub') pubkey = decoded.data
      else if (decoded.type === 'nprofile') pubkey = decoded.data.pubkey
      else throw new Error('Expected a public profile')
    }
    hex.parse(pubkey)
    const records = await this.query([{ authors: [pubkey], kinds: [0], limit: 1 }])
    const result = records.sort(
      (a, b) => b.event.created_at - a.event.created_at || a.event.id.localeCompare(b.event.id)
    )[0]
    let profile = null
    try {
      profile = result ? JSON.parse(result.event.content) : null
    } catch {
      /* Ignore invalid optional input. */
    }
    return { ok: true, pubkey, profile, result }
  }
  async common(message: Record<string, unknown>) {
    if (message.type === 'common.getProfile')
      return this.profile(z.string().max(4096).parse(message.target))
    if (message.type === 'common.follows')
      return { ok: true, pubkeys: this.pubkey() ? await this.tags(this.pubkey()!, 3) : [] }
    if (message.type === 'common.decodeNip19') {
      const value = z.string().max(4096).parse(message.value)
      if (value.toLowerCase().startsWith('nrelay1')) {
        const decoded = bech32.decode(value as `nrelay1${string}`, 4096)
        const bytes = bech32.fromWords(decoded.words)
        let relay: string | undefined
        for (let offset = 0; offset < bytes.length; ) {
          if (offset + 2 > bytes.length || offset + 2 + bytes[offset + 1] > bytes.length)
            throw new Error('invalid-nip19')
          const type = bytes[offset],
            length = bytes[offset + 1]
          if (type === 0) {
            if (relay !== undefined) throw new Error('invalid-nip19')
            relay = new TextDecoder('utf-8', { fatal: true }).decode(
              bytes.slice(offset + 2, offset + 2 + length)
            )
          }
          offset += length + 2
        }
        if (!relay || !/^wss?:\/\//.test(relay)) throw new Error('invalid-nip19')
        const url = new URL(relay)
        if (url.username || url.password || url.hash) throw new Error('invalid-nip19')
        return { ok: true, nip19Type: 'nrelay', relay }
      }
      const decoded = nip19.decode(value)
      if (decoded.type === 'nsec') throw new Error('Secret identifiers are not supported')
      if (decoded.type === 'note' || decoded.type === 'npub')
        return { ok: true, nip19Type: decoded.type, hex: decoded.data }
      if (decoded.type === 'nevent') {
        const { id, ...rest } = decoded.data
        return { ok: true, nip19Type: decoded.type, eventId: id, ...rest }
      }
      return { ok: true, nip19Type: decoded.type, ...decoded.data }
    }
    if (message.type === 'common.encodeNip19') {
      const input = z
        .object({
          type: z.enum(['npub', 'note', 'nprofile', 'nevent', 'naddr', 'nrelay']),
          relay: z.string().max(255).optional(),
          hex: hex.optional(),
          pubkey: hex.optional(),
          eventId: hex.optional(),
          identifier: z.string().max(256).optional(),
          author: hex.optional(),
          kind: z.number().int().min(0).max(65535).optional(),
          relays: z.array(z.string().max(256)).max(8).optional()
        })
        .parse(message.input)
      let value: string
      switch (input.type) {
        case 'nrelay': {
          const relay = z.string().min(1).parse(input.relay),
            url = new URL(relay)
          const bytes = new TextEncoder().encode(relay)
          if (
            !['ws:', 'wss:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.hash ||
            bytes.length > 255
          )
            throw new Error('invalid-nip19')
          value = bech32.encode(
            'nrelay',
            bech32.toWords(new Uint8Array([0, bytes.length, ...bytes])),
            4096
          )
          break
        }
        case 'npub':
          value = nip19.npubEncode(hex.parse(input.hex))
          break
        case 'note':
          value = nip19.noteEncode(hex.parse(input.hex))
          break
        case 'nprofile':
          value = nip19.nprofileEncode({ pubkey: hex.parse(input.pubkey), relays: input.relays })
          break
        case 'nevent':
          value = nip19.neventEncode({
            id: hex.parse(input.eventId),
            author: input.author,
            kind: input.kind,
            relays: input.relays
          })
          break
        case 'naddr':
          value = nip19.naddrEncode({
            pubkey: hex.parse(input.pubkey),
            identifier: z.string().parse(input.identifier),
            kind: z.number().parse(input.kind),
            relays: input.relays
          })
          break
      }
      return { ok: true, value, nip19Type: input.type }
    }
    throw new Error('Account changes and publishing are disabled in this playback client.')
  }
}
