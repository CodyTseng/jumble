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
})
