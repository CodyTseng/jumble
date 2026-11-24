// @vitest-environment jsdom
import { kinds, type Event, type Filter } from 'nostr-tools'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FollowSetsProvider, useFollowSets } from './FollowSetsProvider'

const mocks = vi.hoisted(() => {
  const pubkey = 'a'.repeat(64)
  return {
    pubkey,
    account: { pubkey, signerType: 'nsec' },
    fetchEvents: vi.fn(),
    publish: vi.fn(),
    relay: 'wss://lists.example/'
  }
})
vi.mock('./NostrProvider', () => ({
  useNostr: () => ({
    pubkey: mocks.pubkey,
    account: mocks.account,
    signer: {},
    relayList: { write: [mocks.relay] },
    publish: mocks.publish
  })
}))
vi.mock('@/lib/draft-event', () => ({ createDeletionRequestDraftEvent: vi.fn() }))
vi.mock('@/lib/relay', () => ({ getDefaultRelayUrls: () => [mocks.relay] }))
vi.mock('@/services/client.service', () => ({
  default: {
    fetchEvents: mocks.fetchEvents,
    fetchRelayList: async () => ({ write: [mocks.relay] }),
    getSeenEventRelayUrls: () => []
  }
}))

const original: Event = {
  id: '1'.repeat(64),
  kind: kinds.Followsets,
  pubkey: mocks.pubkey,
  created_at: 1,
  tags: [
    ['d', 'friends'],
    ['title', 'Friends']
  ],
  content: '',
  sig: ''
}
const updatedMember = 'b'.repeat(64)
const newer: Event = {
  ...original,
  id: '2'.repeat(64),
  created_at: 2,
  tags: [...original.tags, ['p', updatedMember]]
}
const deletion: Event = {
  ...original,
  id: '3'.repeat(64),
  kind: kinds.EventDeletion,
  created_at: 3,
  tags: [['e', original.id]]
}

let root: Root
let lists: ReturnType<typeof useFollowSets>
function Probe() {
  lists = useFollowSets()
  return null
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  mocks.publish.mockReset()
  mocks.fetchEvents.mockReset()
  mocks.fetchEvents.mockImplementation(async (_relays: string[], filter: Filter | Filter[]) =>
    Array.isArray(filter) ? [] : [original]
  )
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(() => root.unmount())
  vi.unstubAllGlobals()
})

async function loadProvider() {
  await act(() => root.render(createElement(FollowSetsProvider, null, createElement(Probe))))
}

describe('editing follow lists across devices', () => {
  it('refreshes the editor baseline and stops a save when a relay has a newer revision', async () => {
    await loadProvider()
    const previous = lists.followSets[0]
    mocks.fetchEvents.mockResolvedValueOnce([newer]).mockResolvedValueOnce([])
    await act(async () => {
      expect(await lists.saveFollowSet('Renamed', [], previous)).toBe('changed')
    })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(lists.followSets[0].pubkeys).toEqual([updatedMember])
  })

  it('stops a save when the relay has deleted the exact version in the editor', async () => {
    await loadProvider()
    const previous = lists.followSets[0]
    mocks.fetchEvents.mockResolvedValueOnce([]).mockResolvedValueOnce([deletion])
    await act(async () => {
      expect(await lists.saveFollowSet('Renamed', [], previous)).toBe('changed')
    })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(lists.followSets).toEqual([])
  })

  it('does not publish from an unconfirmed cache when no relay returns the list', async () => {
    await loadProvider()
    const previous = lists.followSets[0]
    mocks.fetchEvents.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await act(async () => {
      expect(await lists.saveFollowSet('Renamed', [], previous)).toBe('unverified')
    })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(lists.followSets[0].event.id).toBe(original.id)
  })

  it('publishes an edit when the relay confirms the expected revision', async () => {
    await loadProvider()
    const previous = lists.followSets[0]
    mocks.publish.mockResolvedValueOnce(newer)
    await act(async () => {
      expect(await lists.saveFollowSet('Renamed', [updatedMember], previous)).toBe('saved')
    })
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        kind: kinds.Followsets,
        tags: [
          ['d', 'friends'],
          ['title', 'Renamed'],
          ['p', updatedMember]
        ]
      }),
      { specifiedRelayUrls: [mocks.relay] }
    )
  })

  it('queries exact-version deletions for a cached list the relay no longer returns', async () => {
    localStorage.setItem(`followSetEvents:${mocks.pubkey}`, JSON.stringify([original]))
    mocks.fetchEvents.mockResolvedValueOnce([]).mockResolvedValueOnce([deletion])
    await loadProvider()
    expect(mocks.fetchEvents.mock.calls[1]?.[1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ '#e': [original.id] })])
    )
    expect(lists.followSets).toEqual([])
  })
})
