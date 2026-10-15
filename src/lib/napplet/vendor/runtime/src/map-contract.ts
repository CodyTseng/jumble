import { z } from 'zod'
import type { ActionTemplate } from './action-contracts'
export const MAP_KIND = 35858
const hex = /^[a-f0-9]{64}$/
const id = /^[a-z0-9][a-z0-9-]{0,31}$/
const address = /^35858:([a-f0-9]{64}):([a-z0-9][a-z0-9-]{0,31})$/
const schema = z
  .object({
    kind: z.union([z.literal(MAP_KIND), z.literal(5)]),
    content: z.string().max(4096),
    tags: z
      .array(z.array(z.string().max(2048)).min(2).max(4))
      .min(3)
      .max(80),
    created_at: z.number().int().nonnegative()
  })
  .strict()
function invalid(): never {
  throw new Error(
    'map-invalid-request: only bounded native map metadata or owner map deletion can be published.'
  )
}
function url(value: string, relay = false) {
  const u = new URL(value)
  if (
    u.protocol !== (relay ? 'wss:' : 'https:') ||
    u.username ||
    u.password ||
    u.hash ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(u.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname) ||
    !u.hostname.includes('.')
  )
    invalid()
}
export function mapTemplate(
  value: unknown,
  pubkey: string
): { template: ActionTemplate; identifier: string; title: string; targetId?: string } {
  const template = schema.parse(value)
  const tags = template.tags
  if (new TextEncoder().encode(template.content).length > 4096) invalid()
  const one = (name: string, required = true) => {
    const matches = tags.filter((t) => t[0] === name)
    if (matches.length > 1 || (required && matches.length !== 1)) invalid()
    return matches[0]?.[1]
  }
  if (template.kind === 5) {
    if (tags.length !== 3 || tags.some((t) => t.length !== 2 || !['a', 'e', 'k'].includes(t[0])))
      invalid()
    const a = one('a')!
    const match = a.match(address)
    const targetId = one('e')!
    if (!match || match[1] !== pubkey || !hex.test(targetId) || one('k') !== '35858') invalid()
    return { template, identifier: match[2], title: match[2], targetId }
  }
  const identifier = one('d')!
  const title = one('title')!
  if (
    !id.test(identifier) ||
    !title.trim() ||
    title.length > 160 ||
    one('version') !== '1' ||
    !hex.test(one('x')!) ||
    one('m') !== 'application/json' ||
    !/^[1-9]\d*$/.test(one('size')!) ||
    Number(one('size')) > 262144
  )
    invalid()
  const plain = new Set([
    'd',
    'title',
    'version',
    'x',
    'm',
    'size',
    'summary',
    'alt',
    'client',
    'server',
    'image',
    't'
  ])
  const lineage = new Set(['A', 'E', 'K', 'P', 'a', 'e', 'k', 'p'])
  for (const t of tags) {
    if (plain.has(t[0])) {
      if (t.length !== 2) invalid()
      if (['summary', 'alt', 'client', 'image'].includes(t[0])) one(t[0], false)
      if (t[0] === 'server' || t[0] === 'image') url(t[1])
      if (t[0] === 't' && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(t[1])) invalid()
    } else if (!lineage.has(t[0])) invalid()
  }
  const hasLineage = tags.some((t) => lineage.has(t[0]))
  if (hasLineage) {
    const root = one('A')!.match(address),
      parent = one('a')!.match(address)
    if (
      !root ||
      !parent ||
      (one('K', false) !== undefined && one('K', false) !== '35858') ||
      (one('k', false) !== undefined && one('k', false) !== '35858') ||
      one('P') !== root[1]
    )
      invalid()
    const own = `35858:${pubkey}:${identifier}`
    if (one('A') === own || one('a') === own) invalid()
    for (const n of ['A', 'a']) {
      const t = tags.find((t) => t[0] === n)!
      if (t.length > 3) invalid()
      if (t[2]) url(t[2], true)
    }
    for (const [n, author] of [
      ['E', root[1]],
      ['e', parent[1]]
    ]) {
      const v = one(n, false)
      if (v !== undefined) {
        const t = tags.find((t) => t[0] === n)!
        if (!hex.test(v) || (t[3] !== undefined && t[3] !== author)) invalid()
        if (t[2]) url(t[2], true)
      }
    }
    for (const t of tags.filter((t) => ['P', 'p', 'K', 'k'].includes(t[0])))
      if (t.length !== 2 || (['P', 'p'].includes(t[0]) && !hex.test(t[1]))) invalid()
    const authors = tags.filter((t) => t[0] === 'p').map((t) => t[1])
    if (
      authors.length > 50 ||
      !authors.includes(parent[1]) ||
      new Set(authors).size !== authors.length
    )
      invalid()
  }
  return { template, identifier, title }
}
export function isMapPublication(message: Record<string, unknown>) {
  const event = message.event as { kind?: unknown; tags?: unknown }
  return (
    event?.kind === MAP_KIND ||
    (event?.kind === 5 &&
      Array.isArray(event.tags) &&
      event.tags.some(
        (t) =>
          Array.isArray(t) &&
          ((t[0] === 'k' && t[1] === '35858') ||
            (t[0] === 'a' && typeof t[1] === 'string' && t[1].startsWith('35858:')))
      ))
  )
}
