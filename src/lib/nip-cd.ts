import { Event, kinds, nip19, verifyEvent } from 'nostr-tools'
import { isValidPubkey } from './pubkey'

export const COMMAND_DEFINITION_KIND = 31992

function isTrigger(value: string) {
  return (
    !value.startsWith('/') &&
    /^[^\s@]+$/u.test(value) &&
    [...value].every((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
  )
}
const ARG_TYPES = new Set([
  'pubkey',
  'event',
  'address',
  'relay',
  'number',
  'bool',
  'enum',
  'word',
  'text'
])

export type TNipCdCommand = {
  id: string
  executor: string
  command: string
  title: string
  description: string
  args: { name: string; label: string; required: boolean; type: string; choices?: string[] }[]
  scopes: { group: string; value: string }[]
}

export type TNipCdContext = {
  kind: 1 | 1111
  author?: string
  tags?: string[][]
  relays?: string[]
}

export function getNipCdPostKind(
  parent: Event | string | undefined,
  useNip22Replies: boolean
): TNipCdContext['kind'] {
  return !parent ||
    (typeof parent !== 'string' && parent.kind === kinds.ShortTextNote && !useNip22Replies)
    ? 1
    : 1111
}

/** Complete qualifier on the first token only. A plain /command is not a relay route. */
export function getNipCdExecutor(content: string): string | undefined {
  const [head] = content.split(/\s/u, 1)
  const match = /^\/([^@]+)@(?:nostr:)?(npub1[a-z0-9]{58})$/u.exec(head)
  if (!match || !isTrigger(match[1])) return
  return getNipCdMentionPubkey(match[2], true)
}

export function getNipCdMentionPubkey(reference: string, npubOnly = false): string | undefined {
  try {
    const decoded = nip19.decode(reference.replace(/^nostr:/, ''))
    if (decoded.type === 'npub') return decoded.data
    if (!npubOnly && decoded.type === 'nprofile') return decoded.data.pubkey
  } catch {
    // A user can type an incomplete or invalid identifier.
  }
}

export function formatNipCdInvocation(command: TNipCdCommand) {
  return `/${command.command}@nostr:${nip19.npubEncode(command.executor)}`
}

function scopeGroup(scope: string): TNipCdCommand['scopes'][number] | undefined {
  const colon = scope.indexOf(':')
  const type = scope.slice(0, colon)
  const value = scope.slice(colon + 1)
  if (type === 'kind' && /^\d+$/u.test(value) && Number(value) <= 65535) {
    return { group: type, value }
  }
  if (type === 'author' && isValidPubkey(value)) return { group: type, value }
  if (type === 'relay' && normalizeScopeRelay(value)) return { group: type, value }
  if (type === 'tag') {
    const nextColon = value.indexOf(':')
    const name = nextColon < 0 ? value : value.slice(0, nextColon)
    if (name) return { group: `tag:${name}`, value }
  }
}

function normalizeScopeRelay(value: string) {
  try {
    const url = new URL(value)
    if (['ws:', 'wss:'].includes(url.protocol) && !url.username && !url.password && !url.hash) {
      return url.href
    }
  } catch {
    // Fail closed for malformed incoming scopes.
  }
}

export function matchesNipCdScope(command: TNipCdCommand, context: TNipCdContext): boolean {
  const groups = new Map<string, boolean>()
  for (const { group, value } of command.scopes) {
    let match: boolean
    if (group === 'kind') {
      match = Number(value) === context.kind
    } else if (group === 'author') {
      match = value === context.author
    } else if (group === 'relay') {
      const relay = normalizeScopeRelay(value)
      match = !!relay && !!context.relays?.some((url) => normalizeScopeRelay(url) === relay)
    } else {
      const name = group.slice('tag:'.length)
      const expected = value.length === name.length ? undefined : value.slice(name.length + 1)
      match = !!context.tags?.some(
        (tag) => tag[0] === name && (expected === undefined ? !!tag[1] : tag[1] === expected)
      )
    }
    groups.set(group, match || groups.get(group) === true)
  }
  return [...groups.values()].every(Boolean)
}

function parseCommand(event: Event, identifier: string): TNipCdCommand | undefined {
  const one = (name: string) => {
    const tags = event.tags.filter((tag) => tag[0] === name)
    if (tags.length === 1 && tags[0].length === 2) return tags[0][1]
  }

  // NIP-01 addressable events use d, with an empty coordinate when omitted.
  const identifiers = event.tags.filter((tag) => tag[0] === 'd')
  if (identifiers.length > 1 || identifiers.some((tag) => tag.length !== 2)) return
  const command = one('command')
  const title = one('title')
  const description = one('description')
  if (!command || !isTrigger(command) || !title?.trim() || !description?.trim()) return

  const names = new Set<string>()
  const args: TNipCdCommand['args'] = []
  const argTags = event.tags.filter((tag) => tag[0] === 'arg')
  let optional = false
  for (const [index, [, name, type, mode, label, ...values]] of argTags.entries()) {
    if (
      !name ||
      names.has(name) ||
      !ARG_TYPES.has(type) ||
      label === undefined ||
      !['required', 'optional'].includes(mode) ||
      optional ||
      (type === 'text' && index !== argTags.length - 1) ||
      (type === 'enum'
        ? !values.length || values.some((value) => !value) || new Set(values).size !== values.length
        : values.length !== 0)
    )
      return
    names.add(name)
    optional = mode === 'optional'
    args.push({
      name,
      label: label || name,
      required: !optional,
      type,
      ...(type === 'enum' ? { choices: values } : {})
    })
  }

  const scopes: TNipCdCommand['scopes'] = []
  for (const tag of event.tags) {
    if (tag[0] !== 's') continue
    const scope = tag.length === 2 ? scopeGroup(tag[1]) : undefined
    if (!scope) return
    scopes.push(scope)
  }

  return { id: identifier, executor: event.pubkey, command, title, description, args, scopes }
}

type TNipCdCatalogRevision = { checkedAt: number; complete?: boolean }

/** A partial read cannot replace a complete snapshot. */
export function isPreferredNipCdCatalog(
  next: TNipCdCatalogRevision,
  previous: TNipCdCatalogRevision
) {
  if (!!next.complete !== !!previous.complete) return !!next.complete
  return next.checkedAt > previous.checkedAt
}

/** Preserve current address heads, including invalid or out-of-scope newer replacements. */
export function mergeNipCdCatalogEvents(events: Event[], author: string, now = Date.now() / 1000) {
  const latest = new Map<string, Event>()
  const verified = new Set<string>()
  if (!isValidPubkey(author)) return []

  for (const event of events) {
    if (
      event.pubkey !== author ||
      !Number.isSafeInteger(event.created_at) ||
      event.created_at < 0 ||
      event.created_at > now + 600 ||
      event.kind !== COMMAND_DEFINITION_KIND ||
      verified.has(event.id)
    )
      continue
    try {
      if (!verifyEvent(event)) continue
    } catch {
      continue
    }
    verified.add(event.id)
    const id = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''
    const previous = latest.get(id)
    if (
      !previous ||
      event.created_at > previous.created_at ||
      (event.created_at === previous.created_at && event.id < previous.id)
    )
      latest.set(id, event)
  }
  return [...latest.values()]
}

export function parseNipCdDefinition(event: Event): TNipCdCommand | undefined {
  if (event.kind !== COMMAND_DEFINITION_KIND || !isValidPubkey(event.pubkey)) return
  return parseCommand(event, event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '')
}

export function parseNipCdCatalog(events: Event[]) {
  return events.flatMap((event) => parseNipCdDefinition(event) ?? [])
}

export function readNipCdCatalog(events: Event[], author: string, now = Date.now() / 1000) {
  return parseNipCdCatalog(mergeNipCdCatalogEvents(events, author, now))
}
