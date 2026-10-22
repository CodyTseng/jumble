import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getScreenSize, observeScreenSize } from './responsive-screen'

describe('responsive screen size', () => {
  let browser: EventTarget & { innerWidth: number; innerHeight: number; devicePixelRatio: number }
  let page: EventTarget & {
    fullscreenElement: object | null
    webkitFullscreenElement?: object | null
    querySelectorAll: ReturnType<typeof vi.fn>
    createElement: ReturnType<typeof vi.fn>
    documentElement: { appendChild: ReturnType<typeof vi.fn> }
  }
  let largeViewportHeight: number | undefined
  let stop: (() => void) | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    largeViewportHeight = undefined
    browser = Object.assign(new EventTarget(), {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 2
    })
    page = Object.assign(new EventTarget(), {
      fullscreenElement: null,
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => ({
        style: { cssText: '' },
        getBoundingClientRect: () => ({ height: largeViewportHeight ?? browser.innerHeight }),
        remove: vi.fn()
      })),
      documentElement: { appendChild: vi.fn() }
    })
    vi.stubGlobal('window', browser)
    vi.stubGlobal('document', page)
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5
    })
  })
  afterEach(() => {
    stop?.()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const resize = (width: number, height = browser.innerHeight) => {
    browser.innerWidth = width
    browser.innerHeight = height
    browser.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(200)
  }

  it.each([
    ['Windows', 'Win32', 0],
    ['Windows with touch', 'Win32', 10],
    ['macOS', 'MacIntel', 0],
    ['Linux', 'Linux x86_64', 0]
  ])('keeps the sidebar in short, wide %s windows', (_, platform, maxTouchPoints) => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0', platform, maxTouchPoints })
    browser.innerWidth = 1400
    browser.innerHeight = 540
    expect(getScreenSize()).toEqual({ isSmallScreen: false, isLargeScreen: true })

    const changed = vi.fn()
    stop = observeScreenSize(changed)
    resize(1400, 400)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: true })
    resize(1000, 400)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: false })
    resize(768, 400)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
  })

  it('keeps desktop layout when loaded with page zoom and a short CSS viewport', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      maxTouchPoints: 0
    })
    browser.innerWidth = 1263
    browser.innerHeight = 540
    browser.devicePixelRatio = 1.5
    expect(getScreenSize()).toEqual({ isSmallScreen: false, isLargeScreen: false })
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    browser.devicePixelRatio = 1
    resize(1895, 810)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: false })
  })

  it('tracks window resizing and folding in both directions', () => {
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    resize(1400)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: true })
    resize(700)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    browser.innerWidth = 768
    expect(getScreenSize().isSmallScreen).toBe(true)
  })

  it.each([
    [1400, 900, false, true],
    [1280, 641, false, true],
    [1279, 641, false, false],
    [769, 641, false, false],
    [768, 641, true, false],
    [1280, 640, true, false],
    [1000, 800, false, false],
    [700, 600, true, false]
  ])('keeps the initial layout when zooming a %i x %i viewport', (width, height, small, large) => {
    browser.innerWidth = width
    browser.innerHeight = height
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    for (const zoom of [1.1, 1.25, 1.5, 1.75, 2, 3, 0.8, 0.5, 1]) {
      browser.devicePixelRatio = 2 * zoom
      resize(Math.round(width / zoom), Math.round(height / zoom))
      expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: small, isLargeScreen: large })
    }
  })

  it('still follows real window resizing while zoomed', () => {
    browser.innerWidth = 1400
    browser.innerHeight = 900
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    browser.devicePixelRatio = 4
    resize(700, 450)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: true })
    resize(500, 400)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: false })
    resize(350, 400)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    resize(700, 300)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
  })

  it('uses the existing zoom level on load as the baseline', () => {
    browser.devicePixelRatio = 3
    browser.innerWidth = 1000
    browser.innerHeight = 800
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    browser.devicePixelRatio = 1.5
    resize(2000, 1600)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: false })
  })

  it('keeps bottom navigation when a tall phone rotates into a wide, short viewport', () => {
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    resize(844, 390)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    resize(1600, 540)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
  })

  it('keeps landscape phones compact even with their browser toolbar hidden', () => {
    browser.innerWidth = 1200
    browser.innerHeight = 480
    largeViewportHeight = 540
    expect(getScreenSize()).toEqual({ isSmallScreen: true, isLargeScreen: false })
  })

  it('requires enough height for sidebar layout and responds to height-only resizing', () => {
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    resize(1400, 640)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    resize(1400, 641)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: true })
    resize(1024, 768)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: false })
  })

  it('does not change layout as the address bar hides and reappears across the height breakpoint', () => {
    browser.innerWidth = 1024
    browser.innerHeight = 610
    largeViewportHeight = 700
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    for (const height of [700, 610, 700, 610]) resize(1024, height)
    expect(changed.mock.calls.every(([size]) => !size.isSmallScreen)).toBe(true)
  })

  it('allows sidebar layout when first opened with the address bar visible', () => {
    browser.innerWidth = 1024
    browser.innerHeight = 610
    largeViewportHeight = 700
    expect(getScreenSize()).toEqual({ isSmallScreen: false, isLargeScreen: false })
  })

  it('keeps sidebar mode during toolbar changes on tablets with enough maximum height', () => {
    browser.innerWidth = 1400
    largeViewportHeight = 680
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    for (const height of [800, 680, 800]) resize(1400, height)
    expect(changed.mock.calls.every(([size]) => !size.isSmallScreen && size.isLargeScreen)).toBe(
      true
    )
    // Resizing the actual window changes lvh too, so compact mode still works.
    largeViewportHeight = 600
    resize(1400, 600)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    largeViewportHeight = 800
    resize(1400, 800)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: true })
  })

  it('rechecks stable height on orientation changes', () => {
    browser.innerWidth = 1024
    largeViewportHeight = 700
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    largeViewportHeight = 600
    browser.dispatchEvent(new Event('orientationchange'))
    vi.advanceTimersByTime(200)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
  })

  it.each(['fullscreenElement', 'webkitFullscreenElement'] as const)(
    'defers resizing until fullscreen exits (%s)',
    (property) => {
      const changed = vi.fn()
      stop = observeScreenSize(changed)
      page[property] = {}
      resize(900)
      expect(changed).toHaveBeenCalledTimes(1)
      page[property] = null
      page.dispatchEvent(new Event('fullscreenchange'))
      vi.advanceTimersByTime(200)
      expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: false, isLargeScreen: false })
    }
  )

  it('keeps mobile layout during native iOS video fullscreen and applies the final exit size', () => {
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    page.dispatchEvent(new Event('webkitbeginfullscreen'))
    resize(844)
    expect(changed).toHaveBeenCalledTimes(1)
    page.dispatchEvent(new Event('webkitendfullscreen'))
    vi.advanceTimersByTime(100)
    resize(390)
    expect(changed).toHaveBeenLastCalledWith({ isSmallScreen: true, isLargeScreen: false })
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('detects a native player already in fullscreen before observation', () => {
    const changed = vi.fn()
    const video = { webkitDisplayingFullscreen: true }
    page.querySelectorAll.mockReturnValue([video])
    stop = observeScreenSize(changed)
    resize(844)
    expect(changed).not.toHaveBeenCalled()
    video.webkitDisplayingFullscreen = false
    page.dispatchEvent(new Event('webkitendfullscreen'))
    vi.advanceTimersByTime(200)
    expect(changed).toHaveBeenCalledOnce()
  })

  it('coalesces intermediate sizes and cancels pending work on cleanup', () => {
    const changed = vi.fn()
    stop = observeScreenSize(changed)
    browser.innerWidth = 1400
    browser.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(100)
    browser.innerWidth = 700
    browser.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(100)
    expect(changed).toHaveBeenCalledTimes(1)
    stop()
    resize(1400)
    expect(changed).toHaveBeenCalledTimes(1)
  })
})
