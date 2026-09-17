import { kinds, nip19 } from 'nostr-tools'
import { describe, expect, it, vi } from 'vitest'
import { createLongFormArticleDraftEvent } from './draft-event'
import { createLongFormDraftFromEvent } from './long-form-article'

vi.mock('@/services/client.service', () => ({
  default: { getEventHint: () => 'wss://cached.example.com' }
}))
vi.mock('@/services/custom-emoji.service', () => ({ default: {} }))
vi.mock('@/services/media-upload.service', () => ({ default: {} }))

const pubkey = 'ab'.repeat(32)
const eventId = 'cd'.repeat(32)
const relay = 'wss://relay.example.com'

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
