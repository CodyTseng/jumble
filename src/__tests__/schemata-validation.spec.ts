/**
 * Schemata validation tests for Jumble's draft event builders.
 *
 * Validates that every create*DraftEvent function in src/lib/draft-event.ts
 * produces events conforming to @nostrability/schemata JSON schemas.
 *
 * Covers 21 kinds: 0, 1, 3, 5, 6, 7, 16, 17, 1111, 9802,
 *   10000, 10001, 10002, 10003, 10012, 10030, 10063,
 *   28934, 28936, 30002, 30078
 *
 * Skipped:
 *   - kind 1018/1068 (NIP-88) — schemata e-tag schema enforces NIP-10 markers
 *     but NIP-88 spec uses bare e tags (https://github.com/nostrability/schemata/issues/108)
 *   - kind 1984 (NIP-56) — schemata schema overly strict on p tag
 *     (https://github.com/nostrability/schemata/issues/107)
 *   - kind 31987 — no schemata schema exists yet
 */

// ── Mocks (must be before any imports that use these services) ──────────
import { vi, describe, it, expect, beforeAll } from 'vitest'

vi.mock('@/services/client.service', () => ({
  default: {
    getEventHint: () => 'wss://relay.example.com',
    getReplaeableEventFromCache: () => undefined,
    fetchEvent: vi.fn().mockResolvedValue(undefined),
    fetchRelayList: vi.fn().mockResolvedValue({ read: [], write: [] })
  }
}))

vi.mock('@/services/custom-emoji.service', () => ({
  default: {
    getEmojiById: () => undefined
  }
}))

vi.mock('@/services/media-upload.service', () => ({
  default: {
    getImetaTagByUrl: () => undefined
  }
}))

// ── Imports ─────────────────────────────────────────────────────────────
import { createRequire } from 'node:module'
import Ajv from 'ajv'
import ajvErrors from 'ajv-errors'
import { kinds, type Event } from 'nostr-tools'

import {
  createProfileDraftEvent,
  createShortTextNoteDraftEvent,
  createFollowListDraftEvent,
  createDeletionRequestDraftEvent,
  createRepostDraftEvent,
  createReactionDraftEvent,
  createCommentDraftEvent,
  createHighlightDraftEvent,
  createMuteListDraftEvent,
  createRelayListDraftEvent,
  createBookmarkDraftEvent,
  createPinListDraftEvent,
  createFavoriteRelaysDraftEvent,
  createUserEmojiListDraftEvent,
  createBlossomServerListDraftEvent,
  createJoinDraftEvent,
  createLeaveDraftEvent,
  createSeenNotificationsAtDraftEvent,
  createRelaySetDraftEvent,
  createExternalContentReactionDraftEvent
} from '@/lib/draft-event'

import { ExtendedKind } from '@/constants'

// ── Schema loading ──────────────────────────────────────────────────────
const require_ = createRequire(import.meta.url)
const schemataBase = require_
  .resolve('@nostrability/schemata')
  .replace(/\/dist\/.*/, '/dist/nips')

function loadSchema(path: string): object {
  return require_(`${schemataBase}/${path}`)
}

/**
 * Recursively strip nested $schema, $id, and errorMessage fields
 * that confuse AJV's strict mode.
 */
function stripSchemaFields(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stripSchemaFields)
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'errorMessage') continue
      if (key === '$schema' || key === '$id') continue
      result[key] = stripSchemaFields(value)
    }
    return result
  }
  return obj
}

function createValidator(schema: object): ReturnType<Ajv['compile']> {
  const cleaned = stripSchemaFields(schema) as Record<string, unknown>
  const ajv = new Ajv({ allErrors: true, strict: false })
  ajvErrors(ajv)
  return ajv.compile(cleaned)
}

// ── Schema definitions (loaded at module level) ─────────────────────────
const kind0Schema = loadSchema('nip-01/kind-0/schema.json')
const kind1Schema = loadSchema('nip-01/kind-1/schema.json')
const kind3Schema = loadSchema('nip-02/kind-3/schema.json')
const kind5Schema = loadSchema('nip-09/kind-5/schema.json')
const kind6Schema = loadSchema('nip-18/kind-6/schema.json')
const kind7Schema = loadSchema('nip-25/kind-7/schema.json')
const kind16Schema = loadSchema('nip-18/kind-16/schema.json')
const kind17Schema = loadSchema('nip-25/kind-17/schema.json')
const kind1111Schema = loadSchema('nip-22/kind-1111/schema.json')
const kind9802Schema = loadSchema('nip-84/kind-9802/schema.json')
const kind10000Schema = loadSchema('nip-51/kind-10000/schema.json')
const kind10001Schema = loadSchema('nip-51/kind-10001/schema.json')
const kind10002Schema = loadSchema('nip-65/kind-10002/schema.json')
const kind10003Schema = loadSchema('nip-51/kind-10003/schema.json')
const kind10012Schema = loadSchema('nip-51/kind-10012/schema.json')
const kind10030Schema = loadSchema('nip-51/kind-10030/schema.json')
const kind10063Schema = loadSchema('nip-b7/kind-10063/schema.json')
const kind28934Schema = loadSchema('nip-43/kind-28934/schema.json')
const kind28936Schema = loadSchema('nip-43/kind-28936/schema.json')
const kind30002Schema = loadSchema('nip-51/kind-30002/schema.json')
const kind30078Schema = loadSchema('nip-78/kind-30078/schema.json')

function buildSchemaRegistry(): Map<number, object> {
  const entries: [number, object][] = [
    [0, kind0Schema],
    [1, kind1Schema],
    [3, kind3Schema],
    [5, kind5Schema],
    [6, kind6Schema],
    [7, kind7Schema],
    [16, kind16Schema],
    [17, kind17Schema],
    [1111, kind1111Schema],
    [9802, kind9802Schema],
    [10000, kind10000Schema],
    [10001, kind10001Schema],
    [10002, kind10002Schema],
    [10003, kind10003Schema],
    [10012, kind10012Schema],
    [10030, kind10030Schema],
    [10063, kind10063Schema],
    [28934, kind28934Schema],
    [28936, kind28936Schema],
    [30002, kind30002Schema],
    [30078, kind30078Schema]
  ]
  return new Map(entries)
}

// ── Helpers ─────────────────────────────────────────────────────────────
const FAKE_PUBKEY = '0'.repeat(64)
const FAKE_PUBKEY_2 = '1'.repeat(64)
const FAKE_ID = 'a'.repeat(64)
const FAKE_SIG = 'b'.repeat(128)

type DraftEvent = { kind: number; content: string; tags: string[][]; created_at: number }

function validateDraftEvent(
  draft: DraftEvent,
  schemaRegistry: Map<number, object>
): { valid: boolean; errors: string[] } {
  const schema = schemaRegistry.get(draft.kind)
  if (!schema) {
    return { valid: false, errors: [`No schema found for kind ${draft.kind}`] }
  }

  const signedEvent = {
    ...draft,
    pubkey: FAKE_PUBKEY,
    id: FAKE_ID,
    sig: FAKE_SIG
  }

  const validate = createValidator(schema)
  const valid = validate(signedEvent) as boolean
  const errors = valid
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message}`)

  return { valid, errors }
}

/** Build a fake signed Event for functions that require one as input */
function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'c'.repeat(64),
    pubkey: FAKE_PUBKEY_2,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'hello nostr',
    sig: 'e'.repeat(128),
    ...overrides
  }
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('Schemata Schema Validation', () => {
  let schemaRegistry: Map<number, object>

  beforeAll(() => {
    schemaRegistry = buildSchemaRegistry()
  })

  it('schema registry has 21 kinds', () => {
    expect(schemaRegistry.size).toBe(21)
  })

  // Kind 0 – Profile metadata
  it('kind 0 (Profile) via createProfileDraftEvent', () => {
    const draft = createProfileDraftEvent(
      JSON.stringify({ name: 'Alice', about: 'Test profile', picture: 'https://example.com/avatar.png' })
    )
    expect(draft.kind).toBe(0)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 1 – Short text note
  it('kind 1 (Short Text Note) via createShortTextNoteDraftEvent', async () => {
    const draft = await createShortTextNoteDraftEvent('Hello, Nostr!', [])
    expect(draft.kind).toBe(1)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('kind 1 (Short Text Note reply) via createShortTextNoteDraftEvent', async () => {
    const parent = makeEvent()
    const draft = await createShortTextNoteDraftEvent('Nice post!', [], { parentEvent: parent })
    expect(draft.kind).toBe(1)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 3 – Follow list
  it('kind 3 (Follow List) via createFollowListDraftEvent', () => {
    const tags = [
      ['p', 'a'.repeat(64), 'wss://relay1.example.com', 'alice'],
      ['p', 'b'.repeat(64), 'wss://relay2.example.com', 'bob']
    ]
    const draft = createFollowListDraftEvent(tags)
    expect(draft.kind).toBe(kinds.Contacts)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 5 – Deletion request
  it('kind 5 (Deletion) via createDeletionRequestDraftEvent', () => {
    const event = makeEvent({ kind: 1 })
    const draft = createDeletionRequestDraftEvent(event)
    expect(draft.kind).toBe(kinds.EventDeletion)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 6 – Repost (text note)
  it('kind 6 (Repost) via createRepostDraftEvent', () => {
    const event = makeEvent({ kind: 1 })
    const draft = createRepostDraftEvent(event)
    expect(draft.kind).toBe(kinds.Repost)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 7 – Reaction
  it('kind 7 (Reaction: like) via createReactionDraftEvent', () => {
    const event = makeEvent()
    const draft = createReactionDraftEvent(event)
    expect(draft.kind).toBe(kinds.Reaction)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('kind 7 (Reaction: custom emoji) via createReactionDraftEvent', () => {
    const event = makeEvent()
    const draft = createReactionDraftEvent(event, '🤙')
    expect(draft.kind).toBe(kinds.Reaction)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 16 – Generic repost (non-text)
  it('kind 16 (Generic Repost) via createRepostDraftEvent', () => {
    const event = makeEvent({ kind: 30023 })
    const draft = createRepostDraftEvent(event)
    expect(draft.kind).toBe(kinds.GenericRepost)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 17 – External content reaction
  it('kind 17 (External Content Reaction) via createExternalContentReactionDraftEvent', () => {
    const draft = createExternalContentReactionDraftEvent('https://example.com/article')
    expect(draft.kind).toBe(ExtendedKind.EXTERNAL_CONTENT_REACTION)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('kind 17 (External Content Reaction: custom) via createExternalContentReactionDraftEvent', () => {
    const draft = createExternalContentReactionDraftEvent('https://example.com/article', '🔥')
    expect(draft.kind).toBe(ExtendedKind.EXTERNAL_CONTENT_REACTION)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 1111 – Comment
  it('kind 1111 (Comment on event) via createCommentDraftEvent', async () => {
    const parent = makeEvent({ kind: 1 })
    const draft = await createCommentDraftEvent('Great post!', parent, [])
    expect(draft.kind).toBe(ExtendedKind.COMMENT)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('kind 1111 (Comment on external content) via createCommentDraftEvent', async () => {
    const draft = await createCommentDraftEvent('Interesting article', 'https://example.com/article', [])
    expect(draft.kind).toBe(ExtendedKind.COMMENT)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 9802 – Highlight
  it('kind 9802 (Highlight from event) via createHighlightDraftEvent', () => {
    const event = makeEvent({ kind: 30023, content: 'A long article with highlighted text in it.' })
    const draft = createHighlightDraftEvent('highlighted text', '', event, [])
    expect(draft.kind).toBe(kinds.Highlights)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10000 – Mute list
  it('kind 10000 (Mute List) via createMuteListDraftEvent', () => {
    const tags = [
      ['p', 'a'.repeat(64)],
      ['e', 'b'.repeat(64)],
      ['word', 'spam'],
      ['t', 'nsfw']
    ]
    const draft = createMuteListDraftEvent(tags)
    expect(draft.kind).toBe(kinds.Mutelist)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10001 – Pin list
  it('kind 10001 (Pin List) via createPinListDraftEvent', () => {
    const tags = [['e', 'a'.repeat(64)], ['e', 'b'.repeat(64)]]
    const draft = createPinListDraftEvent(tags)
    expect(draft.kind).toBe(kinds.Pinlist)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10002 – Relay list
  it('kind 10002 (Relay List) via createRelayListDraftEvent', () => {
    const relays = [
      { url: 'wss://relay1.example.com', scope: 'both' as const },
      { url: 'wss://relay2.example.com', scope: 'read' as const }
    ]
    const draft = createRelayListDraftEvent(relays)
    expect(draft.kind).toBe(kinds.RelayList)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10003 – Bookmark list
  it('kind 10003 (Bookmarks) via createBookmarkDraftEvent', () => {
    const tags = [
      ['e', 'a'.repeat(64)],
      ['a', `30023:${'b'.repeat(64)}:my-article`],
      ['r', 'https://example.com']
    ]
    const draft = createBookmarkDraftEvent(tags)
    expect(draft.kind).toBe(kinds.BookmarkList)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10012 – Favorite relays
  it('kind 10012 (Favorite Relays) via createFavoriteRelaysDraftEvent', () => {
    const draft = createFavoriteRelaysDraftEvent(
      ['wss://relay1.example.com', 'wss://relay2.example.com'],
      []
    )
    expect(draft.kind).toBe(ExtendedKind.FAVORITE_RELAYS)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10030 – User emoji list
  it('kind 10030 (User Emoji List) via createUserEmojiListDraftEvent', () => {
    const tags = [['a', `30030:${'a'.repeat(64)}:my-emojis`]]
    const draft = createUserEmojiListDraftEvent(tags)
    expect(draft.kind).toBe(kinds.UserEmojiList)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 10063 – Blossom server list
  it('kind 10063 (Blossom Server List) via createBlossomServerListDraftEvent', () => {
    const draft = createBlossomServerListDraftEvent([
      'https://blossom1.example.com',
      'https://blossom2.example.com'
    ])
    expect(draft.kind).toBe(ExtendedKind.BLOSSOM_SERVER_LIST)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 28934 – Join request (NIP-43)
  it('kind 28934 (Join) via createJoinDraftEvent', () => {
    const draft = createJoinDraftEvent('invite-code-123')
    expect(draft.kind).toBe(28934)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 28936 – Leave request (NIP-43)
  it('kind 28936 (Leave) via createLeaveDraftEvent', () => {
    const draft = createLeaveDraftEvent()
    expect(draft.kind).toBe(28936)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 30002 – Relay set
  it('kind 30002 (Relay Set) via createRelaySetDraftEvent', () => {
    const draft = createRelaySetDraftEvent({
      id: 'my-set',
      name: 'My Relay Set',
      relayUrls: ['wss://relay1.example.com', 'wss://relay2.example.com']
    })
    expect(draft.kind).toBe(kinds.Relaysets)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  // Kind 30078 – Application-specific data (seen notifications)
  it('kind 30078 (Application Data) via createSeenNotificationsAtDraftEvent', () => {
    const draft = createSeenNotificationsAtDraftEvent()
    expect(draft.kind).toBe(kinds.Application)
    const result = validateDraftEvent(draft, schemaRegistry)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })
})
