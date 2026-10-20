import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePageScrollRestoration } from './usePageScrollRestoration'

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  refIndex: 0,
  effectIndex: 0
}))
vi.mock('react', () => ({
  useRef: (value: unknown) => (hooks.refs[hooks.refIndex++] ??= { current: value }),
  useLayoutEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
    const index = hooks.effectIndex++
    const previous = hooks.effects[index]
    if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return
    hooks.pending.push(() => {
      previous?.cleanup?.()
      hooks.effects[index] = { deps, cleanup: effect() || undefined }
    })
  }
}))

describe('page scroll restoration', () => {
  let browser: EventTarget & { scrollY: number; scrollTo: ReturnType<typeof vi.fn> }
  let viewport: EventTarget & {
    scrollTop: number
    scrollTo: ReturnType<typeof vi.fn>
    getBoundingClientRect: () => { top: number }
    querySelectorAll: () => unknown[]
    contains: () => boolean
  }
  let contentTop: number
  let panelTop: number
  let frames: Map<number, FrameRequestCallback>
  let ref: React.RefObject<HTMLDivElement>

  const flushFrame = () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback(0))
  }
  function render(active: boolean, windowScroll: boolean) {
    hooks.refIndex = hooks.effectIndex = 0
    // This dispatcher runs the hook's effect lifecycles without a browser renderer.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    usePageScrollRestoration({ active, windowScroll, scrollAreaRef: ref })
    hooks.pending.splice(0).forEach((effect) => effect())
  }

  beforeEach(() => {
    hooks.refs = []
    hooks.effects = []
    hooks.pending = []
    contentTop = 600
    panelTop = 8
    frames = new Map()
    let frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    browser = Object.assign(new EventTarget(), {
      scrollY: 0,
      scrollTo: vi.fn(({ top }: { top: number }) => {
        browser.scrollY = top
      })
    })
    const anchor = {
      isConnected: true,
      getBoundingClientRect: () => ({
        top: panelTop + contentTop - viewport.scrollTop - browser.scrollY,
        bottom: panelTop + contentTop + 200 - viewport.scrollTop - browser.scrollY
      })
    }
    viewport = Object.assign(new EventTarget(), {
      scrollTop: 0,
      scrollTo: vi.fn(({ top }: { top: number }) => {
        viewport.scrollTop = top
      }),
      getBoundingClientRect: () => ({ top: panelTop - browser.scrollY }),
      querySelectorAll: () => [anchor],
      contains: () => true
    })
    ref = { current: viewport as unknown as HTMLDivElement }
    vi.stubGlobal('window', browser)
  })
  afterEach(() => {
    hooks.effects.forEach((effect) => effect.cleanup?.())
    vi.unstubAllGlobals()
  })

  it('keeps the same reading anchor when switching between panel and window scrolling', () => {
    render(true, false)
    flushFrame()
    viewport.scrollTop = 500
    viewport.dispatchEvent(new Event('scroll'))
    // The narrower column reflows the content above the saved note.
    contentTop = 900
    panelTop = 0
    render(true, true)
    flushFrame()
    expect(viewport.scrollTop).toBe(0)
    expect(browser.scrollY).toBe(800)

    contentTop = 600
    panelTop = 8
    render(true, false)
    flushFrame()
    expect(viewport.scrollTop).toBe(500)
  })

  it('preserves a hidden page across a mode change without moving the active window', () => {
    render(true, false)
    flushFrame()
    viewport.scrollTop = 500
    viewport.dispatchEvent(new Event('scroll'))
    render(false, false)
    render(false, true)
    expect(browser.scrollTo).not.toHaveBeenCalled()
    contentTop = 900
    panelTop = 0
    render(true, true)
    flushFrame()
    expect(browser.scrollY).toBe(800)
  })

  it('cancels deferred restoration when a page becomes inactive', () => {
    render(true, true)
    render(false, true)
    browser.scrollY = 300
    flushFrame()
    expect(browser.scrollY).toBe(300)
    browser.dispatchEvent(new Event('scroll'))
    render(true, true)
    flushFrame()
    expect(browser.scrollY).toBe(0)
  })

  it('keeps the page top at zero rather than aligning the first card below the header', () => {
    render(true, false)
    flushFrame()
    contentTop = 900
    render(true, true)
    flushFrame()
    expect(browser.scrollY).toBe(0)
  })
})
