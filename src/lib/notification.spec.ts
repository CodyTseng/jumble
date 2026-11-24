import { ExtendedKind } from '@/constants'
import { kinds, nip19, type NostrEvent } from 'nostr-tools'
import { describe, expect, it, vi } from 'vitest'
import { getNotificationFilterType, notificationFilter } from './notification'

vi.mock('@/services/client.service', () => ({ default: {} }))

const currentPubkey = '1'.repeat(64)

function createEvent({
  kind = kinds.Reaction,
  tags = [],
  content = '+'
}: {
  kind?: number
  tags?: string[][]
  content?: string
} = {}): NostrEvent {
  return {
    id: '2'.repeat(64),
    pubkey: '3'.repeat(64),
    created_at: 1,
    kind,
    tags,
    content,
    sig: '4'.repeat(128)
  }
}

function filter(
  event: NostrEvent,
  pubkey: string | null = currentPubkey,
  mutedNoteKeys?: ReadonlySet<string>,
  resolveNote?: Parameters<typeof notificationFilter>[1]['resolveNote']
) {
  return notificationFilter(event, {
    pubkey,
    mutePubkeySet: new Set(),
    mutedNoteKeys,
    resolveNote,
    meetsMinTrustScore: async () => true,
    validateZapReceipt: async () => true
  })
}

describe('notificationFilter', () => {
  it('keeps a reaction without a k tag as a kind 1 reaction', async () => {
    const event = createEvent({ tags: [['p', currentPubkey]] })

    await expect(filter(event)).resolves.toBe(true)
  })

  it.each([ExtendedKind.PICTURE, kinds.CommunityDefinition, ExtendedKind.GROUP_METADATA])(
    'keeps a reaction to supported kind %i',
    async (targetKind) => {
      const event = createEvent({
        tags: [
          ['p', currentPubkey],
          ['k', targetKind.toString()]
        ]
      })

      await expect(filter(event)).resolves.toBe(true)
    }
  )

  it('filters a reaction to an unsupported event kind', async () => {
    const event = createEvent({
      tags: [
        ['p', currentPubkey],
        ['k', kinds.Metadata.toString()]
      ]
    })

    await expect(filter(event)).resolves.toBe(false)
  })

  it('filters an unsupported reaction before the current account is available', async () => {
    const event = createEvent({ tags: [['k', kinds.Metadata.toString()]] })

    await expect(filter(event, null)).resolves.toBe(false)
  })

  it('filters a reaction with a malformed target kind', async () => {
    const event = createEvent({
      tags: [
        ['p', currentPubkey],
        ['k', 'not-a-kind']
      ]
    })

    await expect(filter(event)).resolves.toBe(false)
  })

  it('does not apply the target-kind check to other notification types', async () => {
    const event = createEvent({
      kind: kinds.Repost,
      tags: [
        ['p', currentPubkey],
        ['k', kinds.Metadata.toString()]
      ]
    })

    await expect(filter(event)).resolves.toBe(true)
  })

  it('filters an invalid zap receipt', async () => {
    const event = createEvent({ kind: kinds.Zap })

    await expect(
      notificationFilter(event, {
        pubkey: currentPubkey,
        mutePubkeySet: new Set(),
        meetsMinTrustScore: async () => true,
        validateZapReceipt: async () => false
      })
    ).resolves.toBe(false)
  })
})

describe('muting notifications for one note', () => {
  const mutedId = '5'.repeat(64)
  const otherId = '6'.repeat(64)
  const coordinate = `30023:${currentPubkey}:article`
  const mutedNoteKeys = new Set([mutedId, coordinate])

  it.each([
    [
      kinds.Reaction,
      [
        ['e', otherId],
        ['e', mutedId],
        ['p', currentPubkey]
      ]
    ],
    [kinds.Repost, [['e', mutedId]]],
    [
      kinds.GenericRepost,
      [
        ['e', otherId],
        ['a', coordinate]
      ]
    ],
    [kinds.Zap, [['a', coordinate]]],
    [kinds.Highlights, [['a', coordinate, '', 'source']]],
    [
      kinds.Highlights,
      [
        ['e', otherId],
        ['q', mutedId],
        ['p', currentPubkey]
      ]
    ],
    [ExtendedKind.POLL_RESPONSE, [['e', mutedId]]],
    [kinds.ShortTextNote, [['e', mutedId, '', 'root']]],
    [
      kinds.ShortTextNote,
      [
        ['e', otherId, '', 'root'],
        ['e', mutedId, '', 'reply']
      ]
    ],
    [
      ExtendedKind.COMMENT,
      [
        ['E', otherId],
        ['e', mutedId],
        ['k', '1']
      ]
    ],
    [
      ExtendedKind.VOICE_COMMENT,
      [
        ['A', coordinate],
        ['a', coordinate],
        ['k', '30023']
      ]
    ],
    [kinds.ShortTextNote, [['q', coordinate]]]
  ] satisfies [number, string[][]][])(
    'filters kind %i when it targets the muted note',
    async (kind, tags) => {
      await expect(filter(createEvent({ kind, tags }), currentPubkey, mutedNoteKeys)).resolves.toBe(
        false
      )
    }
  )

  it('filters a note that quotes the muted note through a legacy inline reference', async () => {
    const quote = createEvent({
      kind: kinds.ShortTextNote,
      content: `nostr:${nip19.noteEncode(mutedId)}`
    })

    await expect(filter(quote, currentPubkey, mutedNoteKeys)).resolves.toBe(false)
  })

  it('resolves an e-only reaction to a different revision of a muted article', async () => {
    const kind = kinds.LongFormArticle
    const reaction = createEvent({
      tags: [
        ['e', otherId],
        ['p', currentPubkey],
        ['k', `${kind}`]
      ]
    })
    const article = {
      ...createEvent({ kind, tags: [['d', 'article']] }),
      id: otherId,
      pubkey: currentPubkey
    }
    const resolveNote = vi
      .fn()
      .mockResolvedValueOnce(article)
      .mockResolvedValueOnce({
        ...article,
        tags: [['d', 'unrelated']]
      })

    await expect(filter(reaction, currentPubkey, mutedNoteKeys, resolveNote)).resolves.toBe(false)
    expect(resolveNote).toHaveBeenCalledWith(otherId, currentPubkey, kind)
    await expect(filter(reaction, currentPubkey, mutedNoteKeys, resolveNote)).resolves.toBe(true)
  })

  it('filters a notification for the muted note itself', async () => {
    const mention = { ...createEvent({ kind: kinds.ShortTextNote }), id: mutedId }

    await expect(filter(mention, currentPubkey, mutedNoteKeys)).resolves.toBe(false)
    await expect(filter(mention, currentPubkey, new Set())).resolves.toBe(true)
  })

  it.each([
    [
      kinds.Reaction,
      [
        ['e', mutedId],
        ['e', otherId],
        ['p', currentPubkey]
      ]
    ],
    [
      kinds.ShortTextNote,
      [
        ['e', mutedId, '', 'root'],
        ['e', otherId, '', 'reply']
      ]
    ],
    [
      ExtendedKind.COMMENT,
      [
        ['E', mutedId],
        ['e', otherId],
        ['k', '1']
      ]
    ],
    [kinds.Zap, [['p', currentPubkey]]],
    [
      kinds.Highlights,
      [
        ['e', otherId],
        ['p', currentPubkey]
      ]
    ],
    [kinds.ShortTextNote, [['p', currentPubkey]]]
  ] satisfies [number, string[][]][])(
    'keeps kind %i when it targets a different note or the account',
    async (kind, tags) => {
      await expect(filter(createEvent({ kind, tags }), currentPubkey, mutedNoteKeys)).resolves.toBe(
        true
      )
    }
  )
})

describe('getNotificationFilterType', () => {
  it.each([
    [kinds.Reaction, 'likes'],
    [ExtendedKind.POLL_RESPONSE, 'pollResponses'],
    [kinds.Repost, 'reposts'],
    [kinds.GenericRepost, 'reposts'],
    [kinds.Zap, 'zaps'],
    [kinds.Highlights, 'highlights']
  ] as const)('classifies kind %i as %s', (kind, expected) => {
    expect(getNotificationFilterType(createEvent({ kind }), currentPubkey)).toBe(expected)
  })

  it('classifies replies separately from quotes', () => {
    const reply = createEvent({
      kind: kinds.ShortTextNote,
      tags: [['e', '5'.repeat(64), '', 'reply']]
    })
    const quote = createEvent({ kind: kinds.ShortTextNote, tags: [['p', currentPubkey]] })

    expect(getNotificationFilterType(reply, currentPubkey)).toBe('replies')
    expect(getNotificationFilterType(quote, currentPubkey)).toBe('quotes')
  })

  it('classifies explicit mentions separately from quotes', () => {
    const mention = {
      ...createEvent({ kind: kinds.ShortTextNote, tags: [['p', currentPubkey]] }),
      id: '6'.repeat(64),
      content: `nostr:${nip19.npubEncode(currentPubkey)}`
    }

    expect(getNotificationFilterType(mention, currentPubkey)).toBe('mentions')
  })
})
