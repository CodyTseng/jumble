// @vitest-environment jsdom
import { kinds } from 'nostr-tools'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TFeedInfo } from '@/types'
import { FeedProvider, useFeed } from './FeedProvider'

const mocks = vi.hoisted(() => ({
  pubkey: 'a'.repeat(64),
  getFeedInfo: vi.fn(),
  setFeedInfo: vi.fn(),
  getReplaceableEvent: vi.fn()
}))
vi.mock('./NostrProvider', () => ({
  useNostr: () => ({ pubkey: mocks.pubkey, isInitialized: true })
}))
vi.mock('./FavoriteRelaysProvider', () => ({ useFavoriteRelays: () => ({ relaySets: [] }) }))
vi.mock('@/lib/event-metadata', () => ({ getRelaySetFromEvent: (event: object) => event }))
vi.mock('@/services/indexed-db.service', () => ({
  default: { getReplaceableEvent: mocks.getReplaceableEvent }
}))
vi.mock('@/services/local-storage.service', () => ({
  default: { getFeedInfo: mocks.getFeedInfo, setFeedInfo: mocks.setFeedInfo }
}))

const alice = 'a'.repeat(64)
const bob = 'b'.repeat(64)
const relayUrl = 'wss://example.com/'
const followSet: TFeedInfo = { feedType: 'follow-set', id: `${kinds.Followsets}:${alice}:friends` }
let root: Root
let feed: ReturnType<typeof useFeed>

function Probe() {
  feed = useFeed()
  return null
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.pubkey = alice
  mocks.getFeedInfo.mockReset()
  mocks.setFeedInfo.mockReset()
  mocks.getReplaceableEvent.mockReset()
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(() => root.unmount())
  vi.unstubAllGlobals()
})

async function renderAs(pubkey: string) {
  mocks.pubkey = pubkey
  await act(() => root.render(createElement(FeedProvider, null, createElement(Probe))))
}

describe('account-specific feed selection', () => {
  it.each([
    [{ feedType: 'pinned' }, []],
    [{ feedType: 'relay', id: relayUrl }, [relayUrl]],
    [{ feedType: 'relays', id: 'mine' }, [relayUrl]],
    [{ feedType: 'following' }, []]
  ] as const)('restores %j on switching away from a follow list', async (saved, relayUrls) => {
    mocks.getFeedInfo.mockImplementation((pubkey) => (pubkey === alice ? followSet : saved))
    mocks.getReplaceableEvent.mockResolvedValue({ id: 'mine', relayUrls: [relayUrl] })
    await renderAs(alice)
    expect(feed.feedInfo).toEqual(followSet)
    await renderAs(bob)
    expect(feed.feedInfo).toEqual(saved)
    expect(feed.relayUrls).toEqual(relayUrls)
    expect(feed.isReady).toBe(true)
    expect(mocks.setFeedInfo).not.toHaveBeenCalled()
    await renderAs(alice)
    expect(feed.feedInfo).toEqual(followSet)
  })

  it('ignores a relay set load from the previously active account', async () => {
    mocks.getFeedInfo.mockImplementation((pubkey) =>
      pubkey === alice ? followSet : { feedType: 'relays', id: 'mine' }
    )
    let resolveRelaySet!: (set: { id: string; relayUrls: string[] }) => void
    mocks.getReplaceableEvent.mockReturnValue(
      new Promise((resolve) => {
        resolveRelaySet = resolve
      })
    )
    await renderAs(alice)
    await renderAs(bob)
    await renderAs(alice)
    await act(() => resolveRelaySet({ id: 'mine', relayUrls: [relayUrl] }))
    expect(feed.feedInfo).toEqual(followSet)
    expect(feed.relayUrls).toEqual([])
  })
})
