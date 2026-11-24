import { createFakeEvent } from '@/lib/event-core'
import { createFollowSetDraft, mergeFollowSetEvents } from '@/lib/follow-set'
import { kinds } from 'nostr-tools'
import { describe, expect, it } from 'vitest'

const author = 'a'.repeat(64)
const firstMember = 'b'.repeat(64)
const secondMember = 'c'.repeat(64)

function followSet(id: string, createdAt: number, identifier = 'people:local') {
  return createFakeEvent({
    id,
    pubkey: author,
    kind: kinds.Followsets,
    content: 'encrypted members',
    tags: [
      ['d', identifier],
      ['title', 'Friends'],
      ['p', firstMember, 'wss://relay.example/'],
      ['p', secondMember],
      ['description', 'People I know']
    ],
    created_at: createdAt
  })
}

describe('follow sets', () => {
  it('keeps distinct lists and prefers the latest event with the lowest ID on ties', () => {
    const older = followSet('0', 99)
    const newest = followSet('1', 100)
    const tied = followSet('2', 100)
    const otherSet = followSet('3', 110, 'photography')
    const legacyMute = followSet('4', 120, 'mute')
    const otherAuthor = { ...newest, pubkey: firstMember }

    expect(
      mergeFollowSetEvents(author, [
        older,
        tied,
        newest,
        otherSet,
        legacyMute,
        otherAuthor
      ]).followSets.map((set) => set.event.id)
    ).toEqual(['1', '3'])
  })

  it('keeps an address deletion across stale responses and allows a newer version', () => {
    const old = followSet('1', 99)
    const coordinate = `${kinds.Followsets}:${author}:people:local`
    const deletion = createFakeEvent({
      id: 'delete',
      pubkey: author,
      kind: kinds.EventDeletion,
      tags: [['a', coordinate]],
      created_at: 100
    })
    const forgedDeletion = { ...deletion, pubkey: firstMember }
    expect(mergeFollowSetEvents(author, [old, forgedDeletion]).followSets).toHaveLength(1)
    const deleted = mergeFollowSetEvents(author, [old, deletion])
    expect(deleted.followSets).toEqual([])
    expect(deleted.events).toEqual([deletion])
    expect(mergeFollowSetEvents(author, [...deleted.events, old]).followSets).toEqual([])
    const newer = followSet('2', 101)
    expect(mergeFollowSetEvents(author, [...deleted.events, newer]).followSets[0]?.event).toBe(
      newer
    )
  })

  it('preserves encrypted content, metadata and relay hints when editing public members', () => {
    const older = followSet('1', Math.floor(Date.now() / 1000))
    const added = 'd'.repeat(64)
    const draft = createFollowSetDraft(
      'people:local',
      '  Co-workers  ',
      [firstMember, added],
      older
    )
    expect(draft.content).toBe(older.content)
    expect(draft.created_at).toBeGreaterThan(older.created_at)
    expect(draft.tags).toEqual([
      ['d', 'people:local'],
      ['p', firstMember, 'wss://relay.example/'],
      ['description', 'People I know'],
      ['title', 'Co-workers'],
      ['p', added]
    ])
  })

  it('hides the exact deleted head without suppressing a newer revision', () => {
    const older = followSet('1', 98)
    const head = followSet('2', 99)
    const deletion = createFakeEvent({
      id: 'delete',
      pubkey: author,
      kind: kinds.EventDeletion,
      tags: [['e', head.id]],
      created_at: 100
    })
    const forgedDeletion = { ...deletion, pubkey: firstMember }
    expect(mergeFollowSetEvents(author, [head, forgedDeletion]).followSets).toHaveLength(1)
    const deleted = mergeFollowSetEvents(author, [head, deletion])
    expect(deleted.followSets).toEqual([])
    expect(mergeFollowSetEvents(author, [...deleted.events, older]).followSets).toEqual([])
    const newer = followSet('3', 100)
    expect(mergeFollowSetEvents(author, [...deleted.events, newer]).followSets[0]?.event).toBe(
      newer
    )
  })
})
