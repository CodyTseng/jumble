/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
import { z } from 'zod'
import { nip19 } from 'nostr-tools'
import type { SignedEvent } from '../../protocol/src'

export type ActionTemplate = Pick<SignedEvent, 'kind' | 'tags' | 'content' | 'created_at'>
export type HostSign = (pubkey: string, event: ActionTemplate) => Promise<SignedEvent>
export const publicKey = (value: string) => {
  try {
    if (/^[a-f0-9]{64}$/.test(value)) return value
    const decoded = nip19.decode(value)
    if (decoded.type === 'npub') return decoded.data
  } catch {
    /* Ignore invalid optional input. */
  }
  throw new Error('invalid-pubkey')
}
const hex = z.string().regex(/^[a-f0-9]{64}$/)
const address = z
  .string()
  .max(1024)
  .regex(/^\d{1,5}:[a-f0-9]{64}:[^\u0000-\u001f]*$/)
export const publicHttp = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid-item')
  return url.href
}
export const relayItem = (value: string) => {
  const url = new URL(value)
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('invalid-item')
  return url.href
}
type ItemType = 'pubkey' | 'event' | 'address' | 'hashtag' | 'word' | 'relay' | 'server'
const definitions: [number, string, ItemType[]][] = [
  [3, 'follow-list', ['pubkey']],
  [10000, 'mute-list', ['pubkey', 'event', 'hashtag', 'word']],
  [10001, 'pinned-notes', ['event']],
  [10002, 'relay-list-metadata', ['relay']],
  [10003, 'bookmarks', ['event', 'address']],
  [10006, 'blocked-relays', ['relay']],
  [10007, 'search-relays', ['relay']],
  [10015, 'interests', ['hashtag', 'address']],
  [10063, 'blossom-servers', ['server']],
  [30000, 'follow-sets', ['pubkey']],
  [30002, 'relay-sets', ['relay']],
  [30003, 'bookmark-sets', ['event', 'address']],
  [30015, 'interest-sets', ['hashtag']]
]
export const LIST_SUPPORT = definitions.map(([kind, type, supportedItemTypes]) => ({
  kind,
  type,
  supportedItemTypes,
  addressable: kind >= 30000,
  privateItems: false
}))
export const runtimeActionKinds = [
  ...new Set([3, 7, 1984, 24242, ...definitions.map(([kind]) => kind)])
]
const refSchema = z
  .object({
    kind: z.number().int().min(0).max(65535).optional(),
    type: z.string().max(80).optional(),
    identifier: z.string().min(1).max(256).optional()
  })
  .strict()
const itemSchema = z
  .object({
    itemType: z.enum([
      'pubkey',
      'event',
      'address',
      'hashtag',
      'word',
      'relay',
      'emoji',
      'server',
      'url',
      'group'
    ]),
    value: z.string().min(1).max(2048),
    relay: z.string().max(2048).optional(),
    marker: z.enum(['read', 'write', 'read-write']).optional(),
    label: z.string().max(200).optional(),
    visibility: z.enum(['public', 'private']).optional()
  })
  .strict()
export const listMutationSchema = z
  .object({
    list: refSchema,
    items: z.array(itemSchema).min(1).max(64),
    options: z
      .object({
        create: z.boolean().optional(),
        title: z.string().max(200).optional(),
        description: z.string().max(2000).optional(),
        image: z.string().max(2048).optional()
      })
      .strict()
      .optional()
  })
  .strict()
export type ListMutation = z.infer<typeof listMutationSchema>
export function resolveList(ref: ListMutation['list']) {
  if ((ref.kind === undefined) === (ref.type === undefined)) throw new Error('invalid-list-ref')
  const candidates = LIST_SUPPORT.filter((s) =>
    ref.kind !== undefined ? s.kind === ref.kind : s.type === ref.type
  )
  if (candidates.length > 1) throw new Error('ambiguous-list')
  const support = candidates[0]
  if (!support) throw new Error('unsupported-list')
  if (support.addressable && !ref.identifier) throw new Error('missing-identifier')
  if (!support.addressable && ref.identifier !== undefined) throw new Error('invalid-list-ref')
  return support
}
function itemTag(item: ListMutation['items'][number], support: ReturnType<typeof resolveList>) {
  if (!support.supportedItemTypes.includes(item.itemType as ItemType))
    throw new Error('unsupported-item')
  if (item.visibility === 'private') throw new Error('private-items-unsupported')
  if (item.marker && support.kind !== 10002) throw new Error('invalid-item')
  let tag: string[]
  switch (item.itemType) {
    case 'pubkey':
      tag = ['p', publicKey(item.value)]
      break
    case 'event':
      tag = ['e', hex.parse(item.value)]
      break
    case 'address': {
      const value = address.parse(item.value),
        kind = Number(value.split(':')[0])
      if (
        ([10003, 30003].includes(support.kind) && kind !== 30023) ||
        (support.kind === 10015 && kind !== 30015)
      )
        throw new Error('unsupported-item')
      tag = ['a', value]
      break
    }
    case 'hashtag':
      tag = ['t', item.value.replace(/^#/, '').toLowerCase()]
      if (!tag[1] || /\s/.test(tag[1])) throw new Error('invalid-item')
      break
    case 'word':
      tag = ['word', item.value.toLowerCase()]
      break
    case 'relay':
      tag = [support.kind === 10002 ? 'r' : 'relay', relayItem(item.value)]
      if (item.marker && item.marker !== 'read-write') tag.push(item.marker)
      break
    case 'server':
      tag = ['server', publicHttp(item.value).replace(/\/$/, '')]
      break
    default:
      throw new Error('unsupported-item')
  }
  if (item.relay !== undefined || item.label !== undefined) {
    if (!['pubkey', 'event', 'address'].includes(item.itemType)) throw new Error('invalid-item')
    tag.push(item.relay ? relayItem(item.relay) : '')
    if (item.label !== undefined) {
      if (item.itemType !== 'pubkey') throw new Error('invalid-item')
      tag.push(item.label)
    }
  }
  return tag
}
export function mutateList(input: ListMutation, base: SignedEvent | undefined, remove: boolean) {
  const support = resolveList(input.list)
  const additions = input.items.map((item) => itemTag(item, support))
  // Omitted removal visibility means both public and private under NAP-LISTS.
  if (remove && base?.content && input.items.some((i) => i.visibility !== 'public'))
    throw new Error('private-items-unsupported')
  if (!base && (!input.options?.create || remove)) throw new Error('list-not-found')
  let tags = structuredClone(
    base?.tags ?? (support.addressable ? [['d', input.list.identifier!]] : [])
  )
  if (!base)
    for (const name of ['title', 'description', 'image'] as const) {
      const value = input.options?.[name]
      if (value) tags.push([name, name === 'image' ? publicHttp(value) : value])
    }
  let added = 0,
    removed = 0,
    skipped = 0
  for (const [index, tag] of additions.entries()) {
    const item = input.items[index]
    const same = (old: string[]) => {
      if (old[0] !== tag[0]) return false
      try {
        return (item.itemType === 'relay' ? relayItem(old[1]) : old[1]) === tag[1]
      } catch {
        return false
      }
    }
    if (!remove) {
      // NIP-02 follows identify a person independently of optional relay/petname hints.
      if (
        tags.some((old) =>
          support.kind === 3
            ? same(old)
            : same(old) && JSON.stringify(old.slice(2)) === JSON.stringify(tag.slice(2))
        )
      )
        skipped++
      else {
        tags.push(tag)
        added++
      }
    } else {
      let changed = 0
      tags = tags.flatMap((old) => {
        if (!same(old)) return [old]
        if (support.kind === 10002 && item.marker && item.marker !== 'read-write') {
          if (old[2] === (item.marker === 'read' ? 'write' : 'read')) return [old]
          if (old[2] && !['read', 'write'].includes(old[2])) return [old]
          changed++
          return old[2]
            ? []
            : [[old[0], old[1], item.marker === 'read' ? 'write' : 'read', ...old.slice(3)]]
        }
        changed++
        return []
      })
      removed += changed
      if (!changed) skipped++
    }
  }
  const content = base?.content ?? ''
  if (JSON.stringify({ tags, content }).length > 60000 || tags.length > 2000)
    throw new Error('quota-exceeded')
  return {
    kind: support.kind,
    tags,
    content,
    added,
    removed,
    skipped,
    changed: added + removed > 0
  }
}
