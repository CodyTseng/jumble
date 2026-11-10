// @vitest-environment jsdom

import { useFilteredLikeCount } from '@/hooks/useFilteredLikeCount'
import { TStuffStats } from '@/services/stuff-stats.service'
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Likes from '../StuffStats/Likes'
import ReactionList from './index'

const state = vi.hoisted(() => ({
  muted: new Set<string>(),
  threshold: 0,
  stats: { likes: [] } as Partial<TStuffStats>,
  getMinTrustScore: vi.fn((): number => 0),
  meetsMinTrustScore: vi.fn(async (_pubkey: string, _threshold: number) => true)
}))
vi.mock('@/PageManager', () => ({ useSecondaryPage: () => ({ push: vi.fn() }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: false })
}))
vi.mock('@/providers/MuteListProvider', () => ({
  useMuteList: () => ({ mutePubkeySet: state.muted })
}))
vi.mock('@/providers/UserTrustProvider', () => ({
  useUserTrust: () => ({
    getMinTrustScore: state.getMinTrustScore,
    meetsMinTrustScore: state.meetsMinTrustScore
  })
}))
vi.mock('@/providers/NostrProvider', () => ({ useNostr: () => ({ pubkey: 'self' }) }))
vi.mock('@/hooks/useStuff', () => ({ useStuff: () => ({ stuffKey: 'note' }) }))
vi.mock('@/hooks/useStuffStatsById', () => ({ useStuffStatsById: () => state.stats }))
vi.mock('@/services/client.service', () => ({ default: {} }))
vi.mock('@/services/stuff-stats.service', () => ({ default: {} }))
vi.mock('@/lib/draft-event', () => ({
  createExternalContentReactionDraftEvent: vi.fn(),
  createReactionDraftEvent: vi.fn()
}))
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  ScrollBar: () => null
}))
vi.mock('../Emoji', () => ({
  default: ({ emoji }: { emoji: string | { shortcode: string } }) =>
    createElement('span', null, typeof emoji === 'string' ? emoji : emoji.shortcode)
}))
vi.mock('../Username', () => ({
  default: ({ userId }: { userId: string }) => createElement('span', null, userId)
}))
vi.mock('../UserAvatar', () => ({ default: () => null }))
vi.mock('../Nip05', () => ({ default: () => null }))
vi.mock('../FormattedTimestamp', () => ({ FormattedTimestamp: () => null }))

function Count() {
  return createElement('span', null, useFilteredLikeCount('note'))
}

function reaction(pubkey: string, emoji = '❤️', created_at = 1): TStuffStats['likes'][number] {
  return { id: pubkey, eventId: pubkey, pubkey, emoji, created_at }
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.muted = new Set(['muted'])
  state.threshold = 0
  state.stats = { likes: [reaction('muted'), reaction('visible')] }
  state.getMinTrustScore.mockImplementation(() => state.threshold)
  state.meetsMinTrustScore.mockReset().mockResolvedValue(true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(component: typeof ReactionList | typeof Likes | typeof Count) {
  await act(async () => root.render(createElement(component, { stuff: 'note' })))
}

it.each([0, 10])(
  'filters the list and updates on mute/unmute with threshold=%s',
  async (threshold) => {
    state.threshold = threshold
    state.stats = {
      likes: [reaction('muted', '❤️', 3), reaction('visible', '❤️', 2), reaction('untrusted')]
    }
    state.meetsMinTrustScore.mockImplementation(async (pubkey) => pubkey !== 'untrusted')
    await render(ReactionList)
    expect(container.textContent).not.toContain('muted')
    expect(container.textContent).toContain('visible')
    expect(container.textContent?.includes('untrusted')).toBe(threshold === 0)
    expect(state.meetsMinTrustScore.mock.calls.some(([pubkey]) => pubkey === 'muted')).toBe(false)

    state.muted = new Set()
    await render(ReactionList)
    const rows = container.querySelectorAll('[data-clickable-card]')
    expect(rows[0].textContent).toContain('muted')
    expect(rows[1].textContent).toContain('visible')

    state.muted = new Set(['muted', 'visible', 'untrusted'])
    await render(ReactionList)
    expect(container.querySelectorAll('[data-clickable-card]')).toHaveLength(0)
    expect(container.textContent).toBe('No reactions yet')
  }
)

it.each([0, 10])(
  'filters the count and updates on mute/unmute with threshold=%s',
  async (threshold) => {
    state.threshold = threshold
    state.stats = { likes: [reaction('muted'), reaction('visible'), reaction('untrusted')] }
    state.meetsMinTrustScore.mockImplementation(async (pubkey) => pubkey !== 'untrusted')
    await render(Count)
    expect(container.textContent).toBe(threshold ? '1' : '2')
    state.muted = new Set()
    await render(Count)
    expect(container.textContent).toBe(threshold ? '2' : '3')
    state.muted = new Set(['muted', 'visible', 'untrusted'])
    await render(Count)
    expect(container.textContent).toBe('0')
  }
)

it('excludes muted users before aggregating emoji and removes empty pills', async () => {
  state.stats = { likes: [reaction('muted', '👀'), reaction('visible'), reaction('other')] }
  await render(Likes)
  expect(container.textContent).toBe('❤️2')
  state.muted = new Set(['muted', 'other'])
  await render(Likes)
  expect(container.textContent).toBe('❤️1')
  state.muted = new Set()
  await render(Likes)
  expect(container.textContent).toBe('❤️2👀1')
  state.muted = new Set(['muted', 'visible', 'other'])
  await render(Likes)
  expect(container.innerHTML).toBe('')
})

it('applies trust settings to emoji pills and preserves per-emoji author deduplication', async () => {
  state.stats = {
    likes: [
      reaction('muted', '👀'),
      reaction('visible'),
      { ...reaction('visible'), id: 'duplicate' },
      reaction('untrusted', '👎')
    ]
  }
  state.meetsMinTrustScore.mockImplementation(async (pubkey) => pubkey !== 'untrusted')
  await render(Likes)
  expect(container.textContent).toBe('❤️1👎1')

  state.threshold = 10
  // The real provider changes this callback when trust settings change.
  state.getMinTrustScore = vi.fn(() => state.threshold)
  await render(Likes)
  expect(container.textContent).toBe('❤️1')
  expect(state.meetsMinTrustScore.mock.calls.some(([pubkey]) => pubkey === 'muted')).toBe(false)

  state.threshold = 0
  state.getMinTrustScore = vi.fn(() => state.threshold)
  await render(Likes)
  expect(container.textContent).toBe('❤️1👎1')
})

it.each([ReactionList, Count, Likes])(
  'ignores trust checks from before the mute list changed (%s)',
  async (component) => {
    state.threshold = 10
    state.muted = new Set()
    state.stats = { likes: [reaction('muted')] }
    let resolve!: (value: boolean) => void
    state.meetsMinTrustScore.mockImplementationOnce(
      () =>
        new Promise<boolean>((done) => {
          resolve = done
        })
    )
    await render(component)
    state.muted = new Set(['muted'])
    await render(component)
    await act(async () => resolve(true))
    expect(container.textContent).toBe(
      component === Count ? '0' : component === Likes ? '' : 'No reactions yet'
    )
  }
)
