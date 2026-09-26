import { ExtendedKind } from '@/constants'
import { kinds, nip19, type NostrEvent } from 'nostr-tools'
import { describe, expect, it, vi } from 'vitest'
import { getNotificationFilterType, notificationFilter } from './notification'

vi.mock('@/services/client.service', () => ({ default: {} }))

const currentPubkey = '1'.repeat(64)

function createEvent({
  kind = kinds.Reaction,
  tags = []
}: {
  kind?: number
  tags?: string[][]
} = {}): NostrEvent {
  return {
    id: '2'.repeat(64),
    pubkey: '3'.repeat(64),
    created_at: 1,
    kind,
    tags,
    content: '+',
    sig: '4'.repeat(128)
  }
}

function filter(event: NostrEvent, pubkey: string | null = currentPubkey) {
  return notificationFilter(event, {
    pubkey,
    mutePubkeySet: new Set(),
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
