import { kinds, nip19 } from 'nostr-tools'
import { describe, expect, it, vi } from 'vitest'
import {
  createExternalContentReactionDraftEvent,
  createLongFormArticleDraftEvent,
  createReactionDraftEvent,
  createReplyDraftEvent,
  createShortTextNoteDraftEvent
} from './draft-event'
import { createLongFormDraftFromEvent } from './long-form-article'
import client from '@/services/client.service'

vi.mock('@/services/client.service', () => ({
  default: { getEventHint: () => 'wss://cached.example.com', fetchEvent: vi.fn() }
}))
vi.mock('@/services/custom-emoji.service', () => ({ default: {} }))
vi.mock('@/services/media-upload.service', () => ({ default: {} }))

const pubkey = 'ab'.repeat(32)
const eventId = 'cd'.repeat(32)
const relay = 'wss://relay.example.com'

describe('reply formats', () => {
  const parent = {
    id: eventId,
    pubkey,
    kind: kinds.ShortTextNote,
    content: '',
    tags: [],
    created_at: 1,
    sig: ''
  }

  it.each([undefined, false])(
    'keeps NIP-10 replies when the preference is %s',
    async (useNip22Replies) => {
      const reply = await createReplyDraftEvent('Reply', parent, [pubkey], { useNip22Replies })
      expect(reply.kind).toBe(kinds.ShortTextNote)
      expect(reply.tags).toContainEqual(['e', eventId, 'wss://cached.example.com', 'root', pubkey])
      expect(reply.tags.some(([name]) => name === 'E' || name === 'K')).toBe(false)
    }
  )

  it('uses NIP-22 root and parent tags for a reply to kind 1 when enabled', async () => {
    const reply = await createReplyDraftEvent('Reply #nostr', parent, [pubkey], {
      useNip22Replies: true,
      addClientTag: true,
      protectedEvent: true,
      isNsfw: true
    })
    expect(reply.kind).toBe(1111)
    expect(reply.content).toBe('Reply #nostr')
    expect(reply.tags).toEqual(
      expect.arrayContaining([
        ['E', eventId, 'wss://cached.example.com', pubkey],
        ['K', '1'],
        ['P', pubkey],
        ['e', eventId, 'wss://cached.example.com', pubkey],
        ['k', '1'],
        ['p', pubkey],
        ['t', 'nostr']
      ])
    )
    expect(reply.tags.filter(([name]) => name === 'p')).toHaveLength(1)
    for (const name of ['client', '-', 'content-warning']) {
      expect(reply.tags.some(([tagName]) => tagName === name)).toBe(true)
    }
  })

  it('inherits the NIP-10 root while keeping the kind 1 reply as the parent', async () => {
    const rootId = '12'.repeat(32)
    const rootPubkey = '34'.repeat(32)
    const reply = await createReplyDraftEvent(
      'Reply',
      {
        ...parent,
        tags: [
          ['e', '56'.repeat(32), '', 'reply', '78'.repeat(32)],
          ['e', rootId, relay, 'root', rootPubkey]
        ]
      },
      [],
      { useNip22Replies: true }
    )
    expect(reply.tags).toContainEqual(['E', rootId, relay, rootPubkey])
    expect(reply.tags).toContainEqual(['P', rootPubkey])
    expect(reply.tags).toContainEqual(['K', '1'])
    expect(reply.tags).toContainEqual(['e', eventId, 'wss://cached.example.com', pubkey])
    expect(reply.tags).toContainEqual(['p', pubkey])
    expect(reply.tags).toContainEqual(['k', '1'])
    expect(reply.tags).not.toContainEqual(['P', pubkey])
  })

  it.each([false, true])(
    'preserves an addressable legacy root with an additional e tag: %s',
    async (hasEventRoot) => {
      const articlePubkey = '34'.repeat(32)
      const coordinate = `30023:${articlePubkey}:article:identifier`
      const reply = await createReplyDraftEvent(
        'Reply',
        {
          ...parent,
          tags: [
            ...(hasEventRoot ? [['e', '12'.repeat(32), relay, 'root', pubkey]] : []),
            ['a', coordinate, relay, 'root']
          ]
        },
        [pubkey],
        { useNip22Replies: true }
      )
      expect(reply.kind).toBe(1111)
      expect(reply.tags).toEqual(
        expect.arrayContaining([
          ['A', coordinate, relay],
          ['K', '30023'],
          ['P', articlePubkey],
          ['e', eventId, 'wss://cached.example.com', pubkey],
          ['k', '1'],
          ['p', pubkey]
        ])
      )
      expect(reply.tags.some(([name]) => name === 'E')).toBe(false)
      expect(reply.tags).not.toContainEqual(['P', pubkey])

      const nestedReply = await createReplyDraftEvent(
        'Nested reply',
        { ...reply, id: 'ef'.repeat(32), pubkey, sig: '' },
        [],
        { useNip22Replies: true }
      )
      expect(nestedReply.tags).toEqual(
        expect.arrayContaining([
          ['A', coordinate, relay],
          ['K', '30023'],
          ['P', articlePubkey],
          ['e', 'ef'.repeat(32), 'wss://cached.example.com', pubkey],
          ['k', '1111']
        ])
      )
    }
  )

  it.each(['root', undefined])(
    'fetches the root author for a legacy %s tag without an author',
    async (marker) => {
      const rootId = '12'.repeat(32)
      const rootPubkey = '34'.repeat(32)
      vi.mocked(client.fetchEvent).mockResolvedValueOnce({
        ...parent,
        id: rootId,
        pubkey: rootPubkey
      })
      const reply = await createReplyDraftEvent(
        'Reply',
        {
          ...parent,
          tags: [marker ? ['e', rootId, relay, marker] : ['e', rootId, relay]]
        },
        [],
        { useNip22Replies: true }
      )
      expect(client.fetchEvent).toHaveBeenLastCalledWith(
        nip19.neventEncode({ id: rootId, relays: [relay] })
      )
      expect(reply.tags).toContainEqual(['E', rootId, relay, rootPubkey])
      expect(reply.tags).toContainEqual(['P', rootPubkey])
      expect(reply.tags).toContainEqual(['e', eventId, 'wss://cached.example.com', pubkey])
      expect(reply.tags).toContainEqual(['p', pubkey])
    }
  )

  it('does not substitute the parent author when the root cannot be fetched', async () => {
    const rootId = '12'.repeat(32)
    vi.mocked(client.fetchEvent).mockResolvedValueOnce(undefined)
    const reply = await createReplyDraftEvent(
      'Reply',
      {
        ...parent,
        tags: [['e', rootId, relay, 'root']]
      },
      [],
      { useNip22Replies: true }
    )
    expect(reply.tags).toContainEqual(['E', rootId, relay])
    expect(reply.tags.some(([name]) => name === 'P')).toBe(false)
    expect(reply.tags).toContainEqual(['p', pubkey])
  })

  it.each([false, true])(
    'preserves a comment thread with preference %s',
    async (useNip22Replies) => {
      const comment = await createReplyDraftEvent('Comment', parent, [pubkey], {
        useNip22Replies: true
      })
      const reply = await createReplyDraftEvent(
        'Nested reply',
        {
          ...comment,
          id: 'ef'.repeat(32),
          pubkey,
          sig: ''
        },
        [pubkey],
        { useNip22Replies }
      )
      expect(reply.kind).toBe(1111)
      expect(reply.tags).toEqual(
        expect.arrayContaining([
          ['E', eventId, 'wss://cached.example.com', pubkey],
          ['K', '1'],
          ['P', pubkey],
          ['e', 'ef'.repeat(32), 'wss://cached.example.com', pubkey],
          ['k', '1111']
        ])
      )
    }
  )

  it('keeps comments on other kinds and external content as kind 1111', async () => {
    for (const target of [{ ...parent, kind: 20 }, 'https://example.com']) {
      expect((await createReplyDraftEvent('Reply', target, [])).kind).toBe(1111)
    }
  })

  it('keeps standalone text notes as kind 1', async () => {
    expect((await createShortTextNoteDraftEvent('New note', [])).kind).toBe(1)
  })
})

describe('reaction emoji payloads', () => {
  const target = {
    id: eventId,
    pubkey,
    kind: kinds.ShortTextNote,
    content: '',
    tags: [],
    created_at: 1,
    sig: ''
  }

  it.each(['😀', '❤️', '👩🏽‍💻', '+'])('preserves the selected native reaction %s', (emoji) => {
    expect(createReactionDraftEvent(target, emoji).content).toBe(emoji)
    expect(createExternalContentReactionDraftEvent('https://example.com', emoji).content).toBe(
      emoji
    )
  })

  it('preserves the selected URL when custom emojis share a shortcode', () => {
    for (const url of ['https://example.com/first.png', 'https://example.com/second.png']) {
      const emoji = { shortcode: 'same', url }
      for (const draft of [
        createReactionDraftEvent(target, emoji),
        createExternalContentReactionDraftEvent('https://example.com', emoji)
      ]) {
        expect(draft.content).toBe(':same:')
        expect(draft.tags.filter(([name]) => name === 'emoji')).toEqual([['emoji', 'same', url]])
      }
    }
  })
})

function createArticle(content: string) {
  return createLongFormArticleDraftEvent({
    identifier: 'article',
    title: 'Article',
    content,
    publishedAt: 123
  })
}

describe('createLongFormArticleDraftEvent references', () => {
  it('respects disabled mentions and publishing tags when editing an article', () => {
    const event = createLongFormArticleDraftEvent({
      identifier: 'article',
      title: 'Article',
      content: `${nip19.npubEncode(pubkey)} ${nip19.noteEncode(eventId)}`,
      mentions: [],
      addClientTag: false,
      isNsfw: false,
      protectedEvent: false,
      originalTags: [
        ['p', pubkey],
        ['client', 'Other'],
        ['content-warning', 'NSFW'],
        ['-'],
        ['nonce', '123', '10']
      ]
    })
    expect(
      event.tags.some(([name]) => ['p', 'client', 'content-warning', '-', 'nonce'].includes(name))
    ).toBe(false)
    expect(event.tags).toContainEqual(['q', eventId, 'wss://cached.example.com'])
  })

  it('adds selected mentions, client, NSFW and protected tags once', () => {
    const event = createLongFormArticleDraftEvent({
      identifier: 'article',
      title: 'Article',
      content: '',
      mentions: [pubkey, pubkey],
      addClientTag: true,
      isNsfw: true,
      protectedEvent: true
    })
    for (const name of ['p', 'client', 'content-warning', '-']) {
      expect(event.tags.filter((tag) => tag[0] === name)).toHaveLength(1)
    }
    expect(event.tags).toContainEqual(['p', pubkey])
  })

  it('normalizes bare IDs in the shared preview/publish event builder before generating tags', () => {
    const npub = nip19.npubEncode(pubkey)
    const nevent = nip19.neventEncode({ id: eventId, relays: [relay] })
    const event = createArticle(`\n[author](${npub})\n\n${nevent}\n`)
    expect(event.content).toBe(`\n[author](nostr:${npub})\n\nnostr:${nevent}\n`)
    expect(event.tags).toContainEqual(['p', pubkey])
    expect(event.tags).toContainEqual(['q', eventId, relay])
    expect(event.tags.some(([name]) => name === 'e' || name === 'a')).toBe(false)
  })

  it('updates an existing article without changing its address or first publication time', () => {
    const original = {
      id: eventId,
      pubkey,
      sig: '',
      kind: kinds.LongFormArticle,
      created_at: 456,
      content: 'Original text',
      tags: [
        ['d', 'original-article'],
        ['title', 'Original title'],
        ['summary', 'Original summary'],
        ['image', 'https://example.com/cover.jpg'],
        ['t', 'nostr'],
        ['published_at', '123'],
        ['p', pubkey],
        ['q', eventId],
        ['content-warning', 'Sensitive content'],
        ['-']
      ]
    }
    const draft = createLongFormDraftFromEvent(original)
    expect(draft).toMatchObject({
      identifier: 'original-article',
      title: 'Original title',
      summary: 'Original summary',
      image: 'https://example.com/cover.jpg',
      tags: ['nostr'],
      content: 'Original text',
      publishedAt: 123
    })
    const updated = createLongFormArticleDraftEvent({
      ...draft,
      title: 'Edited title',
      content: 'Edited text',
      summary: '',
      image: ''
    })
    expect(updated.content).toBe('Edited text')
    expect(updated.tags).toEqual([
      ['d', 'original-article'],
      ['title', 'Edited title'],
      ['published_at', '123'],
      ['t', 'nostr'],
      ['content-warning', 'Sensitive content'],
      ['-']
    ])
    expect(updated.created_at).toBeGreaterThan(original.created_at)
  })

  it('uses the original creation time when published_at is missing', () => {
    const draft = createLongFormDraftFromEvent({
      id: eventId,
      pubkey,
      sig: '',
      kind: kinds.LongFormArticle,
      created_at: 456,
      content: '',
      tags: [['d', '']]
    })
    expect(draft.identifier).toBe('')
    expect(draft.publishedAt).toBe(456)
  })

  it('adds deduplicated p tags for plain and Markdown profile mentions', () => {
    const npub = nip19.npubEncode(pubkey)
    const nprofile = nip19.nprofileEncode({ pubkey, relays: [relay] })
    const otherPubkey = 'ef'.repeat(32)
    const content = `nostr:${npub} [author](nostr:${nprofile}) [other][nostr:${nip19.nprofileEncode({ pubkey: otherPubkey })}]`
    const event = createArticle(content)

    expect(event.content).toBe(content)
    expect(event.tags.filter(([name]) => name === 'p')).toEqual([
      ['p', pubkey],
      ['p', otherPubkey]
    ])
  })

  it('adds deduplicated q tags for notes, events and addressable articles with relay hints', () => {
    const nevent = nip19.neventEncode({ id: eventId, author: pubkey, relays: [relay] })
    const note = nip19.noteEncode(eventId)
    const otherId = '12'.repeat(32)
    const naddr = nip19.naddrEncode({
      kind: kinds.LongFormArticle,
      pubkey,
      identifier: 'referenced:article',
      relays: [relay]
    })
    const event = createArticle(
      `[note][nostr:${nevent}] nostr:${note} nostr:${nip19.noteEncode(otherId)} [article](nostr:${naddr}) nostr:${naddr}`
    )

    expect(event.tags.filter(([name]) => name === 'q')).toEqual([
      ['q', eventId, relay, pubkey],
      ['q', otherId, 'wss://cached.example.com'],
      ['q', `30023:${pubkey}:referenced:article`, relay]
    ])
    expect(event.tags.some(([name]) => name === 'e' || name === 'a')).toBe(false)
  })

  it('includes profile tags for valid uppercase bech32 links', () => {
    const npub = nip19.npubEncode(pubkey).toUpperCase()
    const nprofile = nip19.nprofileEncode({ pubkey }).toUpperCase()
    const event = createArticle(`[author](nostr:${nprofile}) nostr:${npub}`)
    expect(event.tags.filter(([name]) => name === 'p')).toEqual([['p', pubkey]])
  })

  it('includes q tags for uppercase event links', () => {
    const nevent = nip19.neventEncode({ id: eventId, relays: [relay] }).toUpperCase()
    expect(createArticle(`nostr:${nevent}`).tags).toContainEqual(['q', eventId, relay])
  })

  it('ignores invalid references and preserves article metadata', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const event = createArticle(
        `nostr:nprofile1invalid nostr:nevent1invalid nostr:${nip19.npubEncode(pubkey)}`
      )
      expect(event.kind).toBe(kinds.LongFormArticle)
      expect(event.tags).toEqual([
        ['d', 'article'],
        ['title', 'Article'],
        ['published_at', '123'],
        ['p', pubkey]
      ])
    } finally {
      error.mockRestore()
    }
  })
})
