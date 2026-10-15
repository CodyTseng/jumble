import { createElement, Fragment, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Tabs from './index'

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as (() => void | (() => void))[],
  stateIndex: 0,
  refIndex: 0,
  deepBrowsing: true,
  dir: 'ltr',
  stickyTop: '48px',
  callback: undefined as IntersectionObserverCallback | undefined,
  observerOptions: undefined as IntersectionObserverInit | undefined,
  observe: vi.fn(),
  disconnect: vi.fn()
}))

// Exercise observer callbacks and component behavior without a DOM renderer.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (next: unknown) => (harness.states[index] = next)]
  },
  useRef: (initial: unknown) => {
    const index = harness.refIndex++
    return (harness.refs[index] ??= { current: initial })
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect)
}))
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: 'scroll-area',
  ScrollBar: 'scroll-bar'
}))
vi.mock('@/components/ui/separator', () => ({ Separator: 'separator' }))
vi.mock('@/lib/utils', () => ({ cn: (...values: unknown[]) => values.filter(Boolean).join(' ') }))
vi.mock('@/providers/DeepBrowsingProvider', () => ({
  useDeepBrowsing: () => ({ deepBrowsing: harness.deepBrowsing })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (value: string) => value, i18n: { dir: () => harness.dir } })
}))

type ElementProps = {
  children: ReactElement[]
  className: string
  dir: string
  onClick: () => void
}
const tabs = [
  { value: 'replies', label: 'Replies', count: 45 },
  { value: 'reactions', label: 'Reactions', dot: true }
]

function render(props: Partial<Parameters<typeof Tabs>[0]> = {}) {
  harness.stateIndex = 0
  harness.refIndex = 0
  harness.effects = []
  const tree = Tabs({ tabs, value: 'replies', ...props })
  return (tree.props.children as ReactElement<ElementProps>[])[1]
}

function mount(scrollRoot: object | null = null) {
  render()
  const sentinel = { closest: vi.fn(() => scrollRoot) }
  harness.refs[1].current = {}
  harness.refs[2].current = sentinel
  // Only run the sticky observer effect; indicator measurements need a browser.
  const cleanup = harness.effects.at(-1)!()
  return { sentinel, cleanup }
}

function notify(bottom: number, rootTop: number | null, isIntersecting = false) {
  harness.callback!(
    [
      {
        boundingClientRect: { bottom },
        rootBounds: rootTop === null ? null : { top: rootTop },
        isIntersecting
      } as IntersectionObserverEntry
    ],
    {} as IntersectionObserver
  )
}

function isHidden(props: Partial<Parameters<typeof Tabs>[0]> = {}) {
  return render(props).props.className.includes('-translate-y-')
}

beforeEach(() => {
  harness.states = []
  harness.refs = []
  harness.effects = []
  harness.deepBrowsing = true
  harness.dir = 'ltr'
  harness.stickyTop = '48px'
  vi.clearAllMocks()
  vi.stubGlobal('getComputedStyle', () => ({ top: harness.stickyTop }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = harness.observe
      disconnect = harness.disconnect
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        harness.callback = callback
        harness.observerOptions = options
      }
    }
  )
})

describe('Tabs sticky visibility', () => {
  it('matches the CSS sticky offset when the default font size is customized', () => {
    harness.stickyTop = '60px'
    mount()
    expect(harness.observerOptions?.rootMargin).toBe('-60px 0px 0px 0px')
  })

  it.each([null, { scrollTop: 0 }])('uses the page scroll root: %s', (root) => {
    const { sentinel, cleanup } = mount(root)
    expect(sentinel.closest).toHaveBeenCalledWith('[data-radix-scroll-area-viewport]')
    expect(harness.observerOptions).toEqual({ root, rootMargin: '-48px 0px 0px 0px' })
    expect(harness.observe).toHaveBeenCalledWith(sentinel)
    cleanup?.()
    expect(harness.disconnect).toHaveBeenCalledOnce()
  })

  it('keeps tabs below the viewport in normal flow while a long note loads', () => {
    mount()
    // The toolbar has since moved, but the sentinel snapshot remains below the viewport.
    const liveGeometry = vi.fn(() => ({ top: 2400 }))
    harness.refs[1].current = { getBoundingClientRect: liveGeometry }
    notify(1600, 48)
    expect(isHidden()).toBe(false)
    expect(liveGeometry).not.toHaveBeenCalled()
  })

  it.each([48, 148])('hides only after crossing the scroll root sticky boundary at %s', (top) => {
    mount()
    notify(top + 100, top, true)
    expect(isHidden()).toBe(false)
    notify(top - 1, top)
    expect(isHidden()).toBe(true)
    notify(top, top, true)
    expect(isHidden()).toBe(false)
  })

  it('restores normal flow if loading content pushes previously sticky tabs below the viewport', () => {
    mount()
    notify(-10, 48)
    expect(isHidden()).toBe(true)
    notify(2000, 48)
    expect(isHidden()).toBe(false)
  })

  it('keeps tabs visible while a filter is active or deep browsing is off', () => {
    mount()
    notify(-10, 48)
    expect(isHidden({ active: true })).toBe(false)
    expect(isHidden({ active: false })).toBe(true)
    harness.deepBrowsing = false
    expect(isHidden()).toBe(false)
  })

  it('does not mark a hidden or unavailable scroll root as sticky', () => {
    mount()
    notify(0, 0)
    expect(isHidden()).toBe(false)
    notify(-10, null)
    expect(isHidden()).toBe(false)
  })

  it.each(['ltr', 'rtl'])('preserves tab actions and horizontal scroll direction in %s', (dir) => {
    harness.dir = dir
    const onTabChange = vi.fn()
    const onCustomize = vi.fn()
    const toolbar = render({ onTabChange, onCustomize, options: createElement(Fragment) })
    const scrollArea = toolbar.props.children[0]
    expect(scrollArea.props.dir).toBe(dir)
    const row = scrollArea.props.children[0]
    row.props.children[0][1].props.onClick()
    expect(onTabChange).toHaveBeenCalledWith('reactions')
    row.props.children[1].props.onClick()
    expect(onCustomize).toHaveBeenCalledOnce()
    expect(toolbar.props.children[1]).toBe(false)
  })
})
