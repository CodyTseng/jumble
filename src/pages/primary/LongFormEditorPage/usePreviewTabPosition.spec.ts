import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import usePreviewTabPosition, { mapPosition } from './usePreviewTabPosition'

const mocks = vi.hoisted(() => ({
  pending: { current: undefined as unknown },
  effects: [] as (() => void | (() => void))[],
  frames: [] as (() => void)[],
  scroll: 200
}))
vi.mock('react', () => ({
  useRef: () => mocks.pending,
  useLayoutEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect)
}))
vi.mock('@/lib/textarea', () => ({
  // An overflow ancestor is not necessarily the page's active scroller.
  findScrollParent: () => ({ scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }) }),
  autoResizeTextarea: vi.fn(),
  getTextareaLineOffsets: () => [0, 100, 200, 300, 400, 500, 600, 700, 800]
}))

describe('single-column tab content position', () => {
  beforeEach(() => {
    mocks.pending.current = undefined
    mocks.effects = []
    mocks.frames = []
    mocks.scroll = 200
    vi.stubGlobal('window', {
      get scrollY() {
        return mocks.scroll
      },
      scrollBy: (_x: number, y: number) => {
        mocks.scroll += y
      },
      scrollTo: (_x: number, y: number) => {
        mocks.scroll = y
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      mocks.frames.push(callback)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('preserves the source paragraph through focus and visibility scroll resets in both directions', () => {
    const editorRef = {
      current: { getBoundingClientRect: () => ({ top: 100 - mocks.scroll }) } as HTMLTextAreaElement
    }
    const previewRef = {
      current: {
        querySelectorAll: () =>
          [
            { line: 1, top: 100, bottom: 850 },
            { line: 5, top: 900, bottom: 1150 },
            { line: 9, top: 1200, bottom: 1300 }
          ].map(({ line, top, bottom }) => ({
            dataset: { sourceLine: String(line), sourceEndLine: String(line) },
            getBoundingClientRect: () => ({
              top: top - mocks.scroll,
              bottom: bottom - mocks.scroll
            })
          }))
      } as unknown as HTMLElement
    }
    const setTab = vi.fn()
    const runEffects = () => {
      const cleanups = mocks.effects.splice(0).map((effect) => effect())
      while (mocks.frames.length) mocks.frames.shift()?.()
      return () => cleanups.forEach((cleanup) => cleanup?.())
    }
    let tabs = usePreviewTabPosition(editorRef, previewRef, 'edit', setTab, true, true)
    runEffects()()
    tabs.prepareTabChange('preview')
    mocks.scroll = 0 // Native focus can scroll before click is dispatched.
    tabs.changeTab('preview')
    expect(setTab).toHaveBeenCalledWith('preview')
    mocks.scroll = 0
    tabs = usePreviewTabPosition(editorRef, previewRef, 'preview', setTab, true, true)
    let cleanup = runEffects()
    expect(mocks.scroll).toBeCloseTo(460)
    tabs.prepareTabChange('edit')
    mocks.scroll = 0
    tabs.changeTab('edit')
    cleanup()
    mocks.scroll = 0
    usePreviewTabPosition(editorRef, previewRef, 'edit', setTab, true, true)
    cleanup = runEffects()
    expect(mocks.scroll).toBeCloseTo(200)
    cleanup()
  })

  it('interpolates within blocks and clamps positions outside the content', () => {
    const points = [
      { from: 1, to: 100 },
      { from: 5, to: 900 }
    ]
    expect(mapPosition(3, points)).toBe(500)
    expect(mapPosition(0, points)).toBe(100)
    expect(mapPosition(8, points)).toBe(900)
    expect(mapPosition(3, [])).toBe(0)
  })
})
