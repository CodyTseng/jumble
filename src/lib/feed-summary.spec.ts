import { Event, finalizeEvent, kinds } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { summarizeFeed } from './feed-summary'

const hex = (n: number) => n.toString(16).padStart(64, '0')
function note(id: number, author = id, overrides: Partial<Event> = {}): Event {
  return {
    id: hex(id),
    pubkey: hex(author),
    kind: kinds.ShortTextNote,
    created_at: id,
    content: '',
    tags: [],
    sig: '',
    ...overrides
  }
}
const quote = (id: number, author: number, target: string) =>
  note(id, author, { tags: [['q', target]] })
const repost = (id: number, author: number, target: string) =>
  note(id, author, { kind: kinds.Repost, tags: [['e', target]] })
const items = (...events: Event[]) => events.map((event) => ({ event }))

describe('summarizeFeed', () => {
  it('ranks reposts, quotes and cached replies with weights 1, 2 and 1', () => {
    const a = note(100),
      b = note(101),
      c = note(102)
    const summary = summarizeFeed(
      [
        { event: a, reposters: [hex(1), hex(2)] },
        ...items(b, c, quote(110, 1, b.id), quote(111, 2, b.id))
      ],
      undefined,
      (key) => (key === c.id ? 5 : 0)
    )
    expect(summary.popularNotes.map((entry) => [entry.key, entry.score])).toEqual([
      [c.id, 5],
      [b.id, 4],
      [a.id, 2]
    ])
  })

  it('does not add a second share score for someone who both reposts and quotes', () => {
    const target = note(100)
    const summary = summarizeFeed([
      { event: target, reposters: [hex(1), hex(2)] },
      ...items(quote(110, 1, target.id), quote(111, 1, target.id))
    ])
    expect(summary.popularNotes[0]).toMatchObject({ people: 2, score: 3, replyCount: 0 })
  })

  it('requires at least three cached replies to qualify without shares', () => {
    const target = note(100)
    expect(summarizeFeed(items(target), undefined, () => 2).popularNotes).toEqual([])
    expect(summarizeFeed(items(target), undefined, () => 3).popularNotes[0]).toMatchObject({
      key: target.id,
      replyCount: 3,
      score: 3
    })
  })

  it('handles an empty feed without inventing dates or rankings', () => {
    expect(summarizeFeed([])).toEqual({
      notes: 0,
      people: 0,
      oldest: undefined,
      newest: undefined,
      topics: [],
      popularNotes: []
    })
  })

  it('deduplicates hashtag spelling and repeated events; excludes URL fragments', () => {
    const event = note(1, 1, {
      content: '#Nostr #nostr https://example.com/#fragment #中文',
      tags: [
        ['t', 'NOSTR'],
        ['t', '#中文']
      ]
    })
    const summary = summarizeFeed(items(event, event))
    expect(summary.notes).toBe(1)
    expect(summary.people).toBe(1)
    expect(summary.topics).toMatchObject(
      expect.arrayContaining([
        { name: 'nostr', notes: 1, people: 1, events: [event] },
        { name: '中文', notes: 1, people: 1, events: [event] }
      ])
    )
    expect(summary.topics).toHaveLength(2)
  })

  it('ranks topics by the displayed note count', () => {
    const events = Array.from({ length: 8 }, (_, i) => note(i + 1, 1, { content: '#spam' }))
    events.push(note(20, 2, { content: '#discussion' }), note(21, 3, { content: '#discussion' }))
    expect(summarizeFeed(items(...events)).topics[0]).toMatchObject({
      name: 'spam',
      notes: 8,
      people: 1
    })
  })

  it('merges reposts and quotes by target, counting unique people across both', () => {
    const original = note(1)
    const summary = summarizeFeed([
      { event: original, reposters: [hex(2), hex(2), hex(3)] },
      ...items(
        repost(10, 2, original.id),
        quote(11, 2, original.id),
        quote(12, 2, original.id),
        quote(13, 4, original.id)
      )
    ])
    expect(summary.popularNotes).toHaveLength(1)
    expect(summary.popularNotes[0]).toMatchObject({ key: original.id, event: original, people: 3 })
    expect([...summary.popularNotes[0].reposters]).toEqual([hex(2), hex(3)])
    expect([...summary.popularNotes[0].quoters]).toEqual([hex(2), hex(4)])
    expect(summary.notes).toBe(4) // One original plus three distinct quote notes.
    expect(summary.people).toBe(4)
  })

  it('does not treat replies, p tags, or malformed q tags as quotes', () => {
    const summary = summarizeFeed(
      items(
        note(1),
        note(2, 2, {
          tags: [
            ['e', hex(1), '', 'reply'],
            ['p', hex(1)],
            ['q', 'invalid']
          ]
        }),
        quote(3, 3, hex(1))
      )
    )
    expect(summary.popularNotes).toEqual([])
  })

  it('counts unresolved repost targets without parsing invalid inline content', () => {
    const summary = summarizeFeed(
      items(repost(1, 10, hex(100)), { ...repost(2, 11, hex(100)), content: '{broken json' })
    )
    expect(summary.notes).toBe(1)
    expect(summary.topics).toMatchObject([])
    expect(summary.popularNotes[0]).toMatchObject({ key: hex(100), event: undefined, people: 2 })
  })

  it('uses verified inline repost content for topics and previews, once per original', () => {
    const original = finalizeEvent(
      {
        kind: 1,
        created_at: 10,
        content: '#nostr',
        tags: []
      },
      new Uint8Array(32).fill(1)
    )
    const a = { ...repost(20, 2, original.id), content: JSON.stringify(original) }
    const b = { ...repost(21, 3, original.id), content: JSON.stringify(original) }
    const summary = summarizeFeed(items(a, b, original))
    expect(summary.notes).toBe(1)
    expect(summary.topics).toMatchObject([{ name: 'nostr', notes: 1, people: 1 }])
    expect(summary.popularNotes[0].event?.id).toBe(original.id)
    expect(summary.oldest).toBe(10)
    expect(summary.newest).toBe(10)
  })

  it('does not expose blocked content through topics or referenced targets', () => {
    const hidden = note(1, 1, { content: '#secret' })
    const summary = summarizeFeed(
      items(hidden, repost(2, 2, hidden.id), quote(3, 3, hidden.id), quote(4, 4, hidden.id)),
      (event) => event.id !== hidden.id
    )
    expect(summary.topics).toMatchObject([])
    expect(summary.popularNotes).toEqual([])
    expect(summary.notes).toBe(2)
  })

  it('unifies ID and address references, preserving only the latest revision', () => {
    const old = note(1, 10, {
      kind: kinds.LongFormArticle,
      tags: [['d', 'article']],
      content: '#old'
    })
    const latest = { ...old, id: hex(2), created_at: 2, content: '#new' }
    const address = `30023:${old.pubkey}:article`
    const summary = summarizeFeed(items(old, latest, quote(3, 11, old.id), quote(4, 12, address)))
    expect(summary.notes).toBe(3)
    expect(summary.topics).toMatchObject([{ name: 'new', notes: 1, people: 1 }])
    expect(summary.popularNotes[0]).toMatchObject({ key: address, event: latest, people: 2 })
  })

  it('keeps all ranked entries for eligibility filtering and backfilling', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      note(i + 1, i + 1, { content: `#topic${i}` })
    )
    for (let i = 0; i < 9; i++) {
      events.push(quote(100 + i * 2, 50, hex(i + 1)), quote(101 + i * 2, 51, hex(i + 1)))
    }
    const summary = summarizeFeed(items(...events))
    expect(summary.topics).toHaveLength(10)
    expect(summary.popularNotes).toHaveLength(9)
  })

  it('uses article publication times and ignores timestamps outside the Date range', () => {
    const article = note(1, 1, {
      kind: kinds.LongFormArticle,
      created_at: 200,
      tags: [
        ['d', 'article'],
        ['published_at', '100']
      ]
    })
    const summary = summarizeFeed(items(article, note(2, 2, { created_at: 9e15 })))
    expect(summary.oldest).toBe(100)
    expect(summary.newest).toBe(100)
  })
})
