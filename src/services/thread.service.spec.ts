import { NostrEvent, kinds } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addEventToCache: vi.fn(),
  getEventHints: vi.fn(() => []),
  putEvents: vi.fn(() => Promise.resolve())
}))

vi.mock('@/services/client.service', () => ({
  default: {
    addEventToCache: mocks.addEventToCache,
    getEventHints: mocks.getEventHints
  }
}))

vi.mock('@/services/indexed-db.service', () => ({
  default: {
    putEvents: mocks.putEvents
  }
}))

vi.mock('@/services/lightning.service', () => ({
  default: {}
}))

vi.mock('@/lib/relay', () => ({
  getDefaultRelayUrls: () => []
}))

function makeReply(id: string, parentId: string, rootId: string): NostrEvent {
  return {
    id,
    pubkey: 'f'.repeat(64),
    created_at: 1,
    kind: kinds.ShortTextNote,
    content: '',
    tags: [
      ['e', rootId, '', 'root'],
      ['e', parentId, '', 'reply']
    ],
    sig: '0'.repeat(128)
  }
}

describe('ThreadService ID topology', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('stores parent-child relationships without retaining event bodies', async () => {
    const threadService = (await import('./thread.service')).default
    const rootId = 'a'.repeat(64)
    const firstReply = makeReply('b'.repeat(64), rootId, rootId)
    const nestedReply = makeReply('c'.repeat(64), firstReply.id, rootId)

    threadService.addRepliesToThread([firstReply, nestedReply], false)

    expect(threadService.getThread(rootId)).toEqual([firstReply.id])
    expect(threadService.getThread(firstReply.id)).toEqual([nestedReply.id])
    expect(threadService.getAllDescendantThreads(rootId)).toEqual(
      new Map([
        [rootId, [firstReply.id]],
        [firstReply.id, [nestedReply.id]]
      ])
    )
    expect(mocks.addEventToCache).toHaveBeenCalledTimes(2)
  })

  it('refreshes the ID snapshot when a known event body arrives again', async () => {
    const threadService = (await import('./thread.service')).default
    const rootId = 'a'.repeat(64)
    const reply = makeReply('b'.repeat(64), rootId, rootId)

    threadService.addRepliesToThread([reply], false)
    const firstSnapshot = threadService.getThread(rootId)

    threadService.addRepliesToThread([reply], false)
    const refreshedSnapshot = threadService.getThread(rootId)

    expect(refreshedSnapshot).toEqual([reply.id])
    expect(refreshedSnapshot).not.toBe(firstSnapshot)
  })

  it('counts cached descendants across ID/address aliases without double-counting', async () => {
    const threadService = (await import('./thread.service')).default
    const root = 'a'.repeat(64)
    const address = `30023:${'f'.repeat(64)}:article`
    const a = makeReply('b'.repeat(64), root, root)
    const b = makeReply('c'.repeat(64), a.id, root)
    const c = {
      ...makeReply('d'.repeat(64), root, root),
      kind: 1111,
      tags: [
        ['k', '30023'],
        ['a', address],
        ['E', root]
      ]
    }
    threadService.addRepliesToThread([a, b, c, a], false)
    expect(threadService.getLoadedReplyCount(address, root)).toBe(3)
    expect(threadService.getLoadedReplyCount(root)).toBe(2)
    expect(threadService.getLoadedReplyCount('unknown')).toBe(0)
  })

  it('notifies cache readers once per batch and unsubscribes without relay subscriptions', async () => {
    const threadService = (await import('./thread.service')).default
    const changed = vi.fn()
    const before = threadService.getRevision()
    const stop = threadService.listenChanges(changed)
    threadService.addRepliesToThread(
      [makeReply('b'.repeat(64), 'a'.repeat(64), 'a'.repeat(64))],
      false
    )
    expect(threadService.getRevision()).toBe(before + 1)
    expect(changed).toHaveBeenCalledTimes(1)
    stop()
    threadService.addRepliesToThread(
      [makeReply('c'.repeat(64), 'a'.repeat(64), 'a'.repeat(64))],
      false
    )
    expect(changed).toHaveBeenCalledTimes(1)
  })
})
