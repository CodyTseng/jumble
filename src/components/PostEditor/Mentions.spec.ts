import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Mentions, { MentionPicker } from './Mentions'
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { extractMentions } from '@/lib/mentions'

const mocks = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  muted: new Set<string>()
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect)
}))
vi.mock('@/lib/mentions', () => ({ extractMentions: vi.fn() }))
vi.mock('@/lib/utils', () => ({ cn: () => '' }))
vi.mock('@/providers/MuteListProvider', () => ({
  useMuteList: () => ({ mutePubkeySet: mocks.muted })
}))
vi.mock('@/providers/NostrProvider', () => ({ useNostr: () => ({ pubkey: 'self' }) }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: false })
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/ui/button', () => ({ Button: () => null }))
vi.mock('@/components/ui/drawer', () => ({ Drawer: () => null, DrawerContent: () => null }))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuCheckboxItem: vi.fn(() => null),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuTrigger: () => null
}))
vi.mock('@/components/UserAvatar', () => ({ SimpleUserAvatar: () => null }))
vi.mock('@/components/Username', () => ({ SimpleUsername: () => null }))

describe('Mentions initial selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.effects.length = 0
    mocks.muted.clear()
  })

  it('selects resolved mentions immediately without first clearing the draft selection', async () => {
    let resolve!: (result: Awaited<ReturnType<typeof extractMentions>>) => void
    vi.mocked(extractMentions).mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const setMentions = vi.fn()
    const onLoadingChange = vi.fn()
    renderToString(
      createElement(Mentions, {
        content: 'an article',
        mentions: ['alice'],
        setMentions,
        onLoadingChange
      })
    )
    const cleanups = mocks.effects.map((effect) => effect())
    expect(setMentions).not.toHaveBeenCalled()
    resolve({ pubkeys: ['alice', 'bob'], relatedPubkeys: [], parentEventPubkey: undefined })
    await Promise.resolve()
    expect(setMentions.mock.calls).toEqual([[['alice', 'bob']]])
    expect(onLoadingChange.mock.calls).toEqual([[true], [false]])
    cleanups.forEach((cleanup) => cleanup?.())
  })

  it('defaults to selected while respecting explicit removals, muted users and self', async () => {
    mocks.muted.add('muted')
    vi.mocked(extractMentions).mockResolvedValue({
      pubkeys: ['alice', 'removed', 'muted', 'self'],
      relatedPubkeys: [],
      parentEventPubkey: undefined
    })
    const setMentions = vi.fn()
    renderToString(
      createElement(Mentions, {
        content: 'an article',
        mentions: [],
        setMentions,
        initialRemovedPubkeys: ['removed']
      })
    )
    mocks.effects.forEach((effect) => effect())
    await Promise.resolve()
    expect(setMentions).toHaveBeenCalledExactlyOnceWith(['alice'])
  })

  it('does not overwrite selections with a cancelled lookup', async () => {
    vi.mocked(extractMentions).mockResolvedValue({
      pubkeys: ['old'],
      relatedPubkeys: [],
      parentEventPubkey: undefined
    })
    const setMentions = vi.fn()
    renderToString(createElement(Mentions, { content: 'old', mentions: [], setMentions }))
    mocks.effects.forEach((effect) => effect()?.())
    await Promise.resolve()
    expect(setMentions).not.toHaveBeenCalled()
  })

  it('renders the editor selection directly and reports checkbox changes without another lookup', () => {
    const setMentions = vi.fn()
    renderToString(
      createElement(MentionPicker, {
        potentialMentions: ['alice', 'bob'],
        mentions: ['alice', 'bob'],
        setMentions,
        compact: true
      })
    )
    const items = vi.mocked(DropdownMenuCheckboxItem).mock.calls.map(([props]) => props)
    expect(items.map((item) => item.checked)).toEqual([true, true])
    // Items are displayed in reverse order, so this deselects Bob.
    items[0].onCheckedChange?.(false)
    expect(setMentions).toHaveBeenCalledExactlyOnceWith(['alice'])
    expect(extractMentions).not.toHaveBeenCalled()
  })
})
