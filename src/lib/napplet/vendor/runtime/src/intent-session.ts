/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
import { validateManifest } from '../../protocol/src/manifest'
import type { SignedEvent } from '../../protocol/src'
import { missingDomains } from './capabilities'
import { isArrayBuffer, isBlob } from '@/lib/napplet/binary'

export type IntentContract = { convention: string; params: string[] }
export type IntentCandidate = {
  id: string
  title?: string
  actions: string[]
  conventions: string[]
  contracts: IntentContract[]
  isDefault?: boolean
}
export type IntentAvailability = {
  archetype: string
  available: boolean
  candidates: IntentCandidate[]
  hasDefault: boolean
}
export type IntentRequest = {
  archetype: string
  action: string
  convention: string
  payload?: unknown
  handler?: string
  behavior?: { focus?: boolean; reuse?: boolean }
}
export type IntentDelivery = Omit<IntentRequest, 'handler' | 'behavior'> & { sender: string }
export type IntentResult = {
  ok: boolean
  archetype?: string
  action?: string
  convention?: string
  handler?: string
  error?: string
}
export type IntentEntry = {
  id: string
  title?: string
  contracts: IntentContract[]
  manifest?: SignedEvent
}
export type IntentEndpoint = {
  handle(message: Record<string, unknown>): Promise<Record<string, unknown>>
  ready(): void
  close(): void
}
const convention = /^napplet:([^/?#\s\u0000-\u001f\u007f]+)\/([^/?#\s\u0000-\u001f\u007f]+)$/
/** Catalog ids are shell-local opaque identifiers; never use a bare d-tag. */
export function intentCatalogId(event: Pick<SignedEvent, 'kind' | 'pubkey' | 'id' | 'tags'>) {
  return event.kind === 5129
    ? `soy:snapshot:${event.id}`
    : `soy:manifest:${event.kind}:${event.pubkey}:${event.kind === 35129 ? (event.tags.find((t) => t[0] === 'd')?.[1] ?? '') : ''}`
}
export function intentContracts(tags: string[][]) {
  const roles = new Set(tags.filter((t) => t[0] === 'z' && t.length === 2).map((t) => t[1]))
  const contracts = new Map<string, IntentContract>()
  for (const tag of tags) {
    const match = tag[0] === 'i' && convention.exec(tag[1] ?? '')
    if (
      !match ||
      !roles.has(match[1]) ||
      tag.slice(2).some((p) => !p || /[\s?&#=/\u0000-\u001f\u007f]/.test(p))
    )
      continue
    try {
      decodeURIComponent(tag[1])
    } catch {
      continue
    }
    const existing = contracts.get(tag[1])
    contracts.set(tag[1], {
      convention: tag[1],
      params: [...new Set([...(existing?.params ?? []), ...tag.slice(2)])]
    })
  }
  return [...contracts.values()]
}
const MAX_INTENT_PAYLOAD_BYTES = 1024 * 1024
const MAX_PENDING_INTENT_BYTES = 8 * 1024 * 1024
/** Resource accounting only: payload contents never participate in handler selection. */
function payloadBytes(value: unknown, limit = MAX_INTENT_PAYLOAD_BYTES) {
  const seen = new Set<object>()
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }]
  let bytes = 0,
    nodes = 0
  const text = new TextEncoder()
  while (queue.length) {
    const { value: item, depth } = queue.pop()!
    if (++nodes > 10000 || depth > 64) throw new Error('intent payload too large')
    if (typeof item === 'function' || typeof item === 'symbol')
      throw new Error('invalid intent payload')
    if (typeof item === 'string') {
      if (item.length > limit) throw new Error('intent payload too large')
      bytes += text.encode(item).byteLength
    } else if (typeof item === 'bigint') bytes += item.toString().length
    else if (!item || typeof item !== 'object') bytes += 8
    else if (!seen.has(item)) {
      seen.add(item)
      bytes += 32
      if (isBlob(item)) bytes += item.size
      else if (ArrayBuffer.isView(item)) bytes += item.buffer.byteLength
      else if (
        isArrayBuffer(item) ||
        (typeof SharedArrayBuffer !== 'undefined' && item instanceof SharedArrayBuffer)
      )
        bytes += item.byteLength
      else if (item instanceof Error) {
        bytes += text.encode(item.message + (item.stack ?? '')).byteLength
        if (item.cause !== undefined) queue.push({ value: item.cause, depth: depth + 1 })
      } else if (item instanceof Date) bytes += 8
      else if (item instanceof RegExp) bytes += text.encode(item.source).byteLength
      else if (item instanceof Map) {
        if (item.size > 5000) throw new Error('intent payload too large')
        for (const [key, value] of item) {
          queue.push({ value: key, depth: depth + 1 }, { value, depth: depth + 1 })
        }
      } else if (item instanceof Set) {
        if (item.size > 10000) throw new Error('intent payload too large')
        for (const value of item) queue.push({ value, depth: depth + 1 })
      } else {
        if (Array.isArray(item)) bytes += item.length * 8
        for (const [key, value] of Object.entries(item)) {
          bytes += text.encode(key).byteLength
          queue.push({ value, depth: depth + 1 })
        }
      }
    }
    if (bytes > limit || queue.length > 10000) throw new Error('intent payload too large')
  }
  return bytes
}
/** Bound the whole structured-clone envelope, including unknown fields.
 * The request validator separately enforces the 1 MiB payload cap. */
export function intentMessageBytes(message: Record<string, unknown>) {
  return payloadBytes(message, MAX_INTENT_PAYLOAD_BYTES + 16 * 1024)
}
function request(input: unknown): IntentRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('invalid convention')
  const value = input as IntentRequest
  const match = typeof value.convention === 'string' && convention.exec(value.convention)
  if (match) {
    try {
      decodeURIComponent(value.convention)
    } catch {
      throw new Error('invalid convention')
    }
  }
  if (
    !match ||
    value.convention.length > 1024 ||
    match[1] !== value.archetype ||
    match[2] !== value.action
  )
    throw new Error('invalid convention')
  if (
    value.handler !== undefined &&
    (typeof value.handler !== 'string' || !value.handler || value.handler.length > 1024)
  )
    throw new Error('invalid handler')
  if (
    value.behavior !== undefined &&
    (!value.behavior ||
      typeof value.behavior !== 'object' ||
      Array.isArray(value.behavior) ||
      Object.entries(value.behavior).some(
        ([key, v]) => !['focus', 'reuse'].includes(key) || typeof v !== 'boolean'
      ))
  )
    throw new Error('invalid behavior')
  payloadBytes(value.payload)
  // Copy only official fields. A caller-provided sender is never propagated.
  try {
    return structuredClone({
      archetype: value.archetype,
      action: value.action,
      convention: value.convention,
      ...(Object.hasOwn(value, 'payload') ? { payload: value.payload } : {}),
      ...(value.handler !== undefined ? { handler: value.handler } : {}),
      ...(value.behavior ? { behavior: value.behavior } : {})
    })
  } catch {
    throw new Error('invalid intent payload')
  }
}
/** One workspace owns accepted deliveries independently of the source's lifetime. */
export class IntentWorkspace {
  private catalog = new Map<string, IntentEntry>()
  private defaults = new Map<string, string>()
  private endpoints = new Set<{
    id: string
    ready: boolean
    sequence: number
    send: (message: Record<string, unknown>) => void
  }>()
  private pending: { target: string; delivery: IntentDelivery; bytes: number }[] = []
  private startup = new Map<
    string,
    { controller: AbortController; after: number; timer: ReturnType<typeof setTimeout> }
  >()
  private sequence = 0
  private listeners = new Set<() => void>()
  private knownRoles = new Set<string>()
  constructor(
    private options: {
      discover?: (archetype: string) => Promise<void>
      choose: (availability: IntentAvailability, request: IntentRequest) => Promise<string | null>
      launch: (
        entry: IntentEntry,
        behavior: IntentRequest['behavior'],
        signal?: AbortSignal
      ) => Promise<void>
      startupTimeoutMs?: number
      focus?: (id: string) => void
      failed?: (entry: IntentEntry, error: unknown) => void
      defaults?: Record<string, string>
      saveDefaults?: (defaults: Record<string, string>) => void
    }
  ) {
    for (const [role, id] of Object.entries(options.defaults ?? {})) this.defaults.set(role, id)
  }
  /** Jumble rebinds foreground UI callbacks without retaining a retired account session. */
  setHost(options: Partial<IntentWorkspace['options']>) {
    this.options = { ...this.options, ...options }
  }
  /** Account transitions discard pending payloads as well as catalog metadata. */
  dispose() {
    for (const id of this.startup.keys()) this.dropPending(id)
    this.pending = []
    this.catalog.clear()
    this.defaults.clear()
    this.endpoints.clear()
    this.listeners.clear()
    this.knownRoles.clear()
    this.options = { choose: async () => null, launch: async () => {} }
  }
  async install(input: unknown, title?: string) {
    const release = await validateManifest(input)
    const entry = {
      id: intentCatalogId(release.manifest),
      manifest: release.manifest,
      title,
      contracts: intentContracts(release.manifest.tags)
    }
    if (missingDomains(release.domains).length) throw new Error('unsupported handler capabilities')
    this.register(entry)
    return entry
  }
  /** Trusted local preview only; public catalogs must use install(). */
  register(entry: IntentEntry) {
    this.catalog.set(entry.id, structuredClone(entry))
    this.changed()
  }
  remove(id: string) {
    this.catalog.delete(id)
    this.dropPending(id)
    this.changed()
  }
  /** Shell terminal failure or user cancellation; no second wire result is emitted. */
  dropPending(target: string) {
    const count = this.pending.filter((p) => p.target === target).length
    this.pending = this.pending.filter((p) => p.target !== target)
    const startup = this.startup.get(target)
    if (startup) {
      clearTimeout(startup.timer)
      this.startup.delete(target)
      startup.controller.abort()
    }
    return count
  }
  /** Shell policy may reuse a ready surface even when the caller suggests replacement. */
  reuseTarget(target: string) {
    if (![...this.endpoints].some((endpoint) => endpoint.id === target && endpoint.ready))
      return false
    const startup = this.startup.get(target)
    if (startup) {
      clearTimeout(startup.timer)
      this.startup.delete(target)
    }
    return this.flush(target)
  }
  entry(id: string) {
    const e = this.catalog.get(id)
    return e && structuredClone(e)
  }
  setDefault(archetype: string, id: string | null) {
    if (id && !this.available(archetype).candidates.some((c) => c.id === id))
      throw new Error('unknown handler')
    if (id) this.defaults.set(archetype, id)
    else this.defaults.delete(archetype)
    this.options.saveDefaults?.(Object.fromEntries(this.defaults))
    this.changed()
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  available(archetype: string): IntentAvailability {
    const candidates: IntentCandidate[] = []
    for (const entry of this.catalog.values()) {
      const contracts = entry.contracts.filter(
        (c) => convention.exec(c.convention)?.[1] === archetype
      )
      if (!contracts.length) continue
      candidates.push({
        id: entry.id,
        title: entry.title,
        contracts: structuredClone(contracts),
        actions: [...new Set(contracts.map((c) => convention.exec(c.convention)![2]))],
        conventions: contracts.map((c) => c.convention),
        isDefault: this.defaults.get(archetype) === entry.id
      })
    }
    return {
      archetype,
      available: !!candidates.length,
      candidates,
      hasDefault: candidates.some((c) => c.isDefault)
    }
  }
  handlers() {
    return [
      ...new Set(
        [...this.catalog.values()].flatMap((e) =>
          e.contracts.map((c) => convention.exec(c.convention)?.[1]).filter((v): v is string => !!v)
        )
      )
    ].map((role) => this.available(role))
  }
  private changed() {
    for (const availability of this.handlers()) this.knownRoles.add(availability.archetype)
    for (const endpoint of this.endpoints)
      if (endpoint.ready)
        for (const role of this.knownRoles)
          endpoint.send({ type: 'intent.changed', availability: this.available(role) })
    for (const listener of this.listeners) listener()
  }
  private flush(target: string) {
    const endpoint = [...this.endpoints].reverse().find((e) => e.id === target && e.ready)
    if (!endpoint) return false
    const deliveries = this.pending.filter((p) => p.target === target)
    this.pending = this.pending.filter((p) => p.target !== target)
    for (const { delivery } of deliveries) {
      try {
        endpoint.send({ type: 'intent.deliver', delivery })
      } catch (error) {
        endpoint.ready = false
        this.dropPending(target)
        const entry = this.catalog.get(target)
        if (entry) this.options.failed?.(entry, error)
        break
      }
    }
    return true
  }
  attach(id: string, send: (message: Record<string, unknown>) => void): IntentEndpoint {
    if (!this.catalog.has(id)) throw new Error('source not installed')
    const endpoint = { id, send, ready: false, sequence: ++this.sequence }
    this.endpoints.add(endpoint)
    let alive = true
    return {
      ready: () => {
        if (alive) {
          endpoint.ready = true
          const startup = this.startup.get(id)
          if (startup && endpoint.sequence <= startup.after) return
          if (startup) {
            clearTimeout(startup.timer)
            this.startup.delete(id)
          }
          this.flush(id)
        }
      },
      close: () => {
        alive = false
        this.endpoints.delete(endpoint)
      },
      handle: async (message) => {
        if (!alive) throw new Error('source closed')
        if (message.type === 'intent.available') {
          const archetype = typeof message.archetype === 'string' ? message.archetype : ''
          await this.options.discover?.(archetype)
          return { availability: this.available(archetype) }
        }
        if (message.type === 'intent.handlers') {
          await this.options.discover?.('')
          return { handlers: this.handlers() }
        }
        if (message.type !== 'intent.invoke') throw new Error('unsupported intent operation')
        try {
          const value = request(message.request)
          await this.options.discover?.(value.archetype)
          const availability = this.available(value.archetype)
          const candidates = availability.candidates.filter((c) =>
            c.conventions.includes(value.convention)
          )
          if (!candidates.length) throw new Error('no handler')
          let selected: string | undefined
          if (value.handler && !['default', 'choose'].includes(value.handler)) {
            selected = candidates.find((c) => c.id === value.handler)?.id
            // Explicit catalog ids require a user choice each invocation.
            if (!selected) throw new Error('unsupported convention')
            selected =
              (await this.options.choose(
                { ...availability, candidates: candidates.filter((c) => c.id === selected) },
                value
              )) ?? undefined
          } else if (
            value.handler === 'choose' ||
            (candidates.length > 1 && !candidates.some((c) => c.isDefault))
          )
            selected =
              (await this.options.choose({ ...availability, candidates }, value)) ?? undefined
          else selected = candidates.find((c) => c.isDefault)?.id ?? candidates[0].id
          if (!selected) throw new Error('user cancelled')
          if (
            !candidates.some((c) => c.id === selected) ||
            (value.handler &&
              !['default', 'choose'].includes(value.handler) &&
              selected !== value.handler)
          )
            throw new Error('invoke rejected')
          if (!alive) throw new Error('source closed')
          const entry = this.catalog.get(selected)
          if (!entry || !entry.contracts.some((c) => c.convention === value.convention))
            throw new Error('unsupported convention')
          const bytes = payloadBytes(value.payload)
          if (
            this.pending.length >= 64 ||
            this.pending.reduce((sum, p) => sum + p.bytes, 0) + bytes > MAX_PENDING_INTENT_BYTES
          )
            throw new Error('intent queue full')
          const queued = {
            target: selected,
            bytes,
            delivery: {
              sender: id,
              archetype: value.archetype,
              action: value.action,
              convention: value.convention,
              ...(Object.hasOwn(value, 'payload') ? { payload: value.payload } : {})
            }
          }
          this.pending.push(queued)
          // Launch after returning acceptance; source can be closed immediately afterwards.
          setTimeout(() => {
            if (!this.catalog.has(selected!) || !this.pending.includes(queued)) return
            // A cold target owns every queued delivery until it becomes ready.
            if (this.startup.has(selected!)) return
            if (value.behavior?.reuse !== false && this.flush(selected!)) {
              if (value.behavior?.focus !== false) this.options.focus?.(selected!)
              return
            }
            const controller = new AbortController()
            const state = {
              controller,
              after: this.sequence,
              timer: setTimeout(
                () => fail(new Error('intent target startup timed out')),
                this.options.startupTimeoutMs ?? 30000
              )
            }
            const fail = (error: unknown) => {
              if (this.startup.get(selected!) !== state) return
              this.dropPending(selected!)
              this.options.failed?.(entry, error)
            }
            this.startup.set(selected!, state)
            void Promise.resolve()
              .then(() =>
                this.options.launch(structuredClone(entry), value.behavior, controller.signal)
              )
              .catch(fail)
          }, 0)
          return {
            result: {
              ok: true,
              archetype: value.archetype,
              action: value.action,
              convention: value.convention,
              handler: selected
            } satisfies IntentResult
          }
        } catch (error) {
          return {
            result: {
              ok: false,
              error: error instanceof Error ? error.message : 'invoke rejected'
            } satisfies IntentResult
          }
        }
      }
    }
  }
}
