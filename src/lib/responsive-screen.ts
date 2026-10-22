import { isMobileOperatingSystem } from './device'

export type ScreenSize = { isSmallScreen: boolean; isLargeScreen: boolean }

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null }
type FullscreenVideo = HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }

function getLayoutViewportHeight() {
  // lvh uses the height with browser chrome retracted. Unlike innerHeight, it
  // stays stable while scrolling hides/shows the address bar, but still follows
  // real window resizing, rotation and folding. vh is a fallback for older engines.
  const probe = document.createElement('div')
  probe.style.cssText =
    'all:initial;position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none;contain:strict'
  document.documentElement.appendChild(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height || window.innerHeight
}

function getLayoutViewport(zoom = 1) {
  return {
    width: Math.round(window.innerWidth * zoom),
    height: Math.round(getLayoutViewportHeight() * zoom)
  }
}

function classifyScreenSize({ width, height }: ReturnType<typeof getLayoutViewport>): ScreenSize {
  // Keep landscape phones compact without forcing wide desktop windows into
  // mobile layout when they are short. The desktop sidebar can scroll.
  const isSmallScreen = width <= 768 || (isMobileOperatingSystem() && height <= 640)
  return {
    isSmallScreen,
    isLargeScreen: !isSmallScreen && width >= 1280
  }
}

export function getScreenSize(): ScreenSize {
  return classifyScreenSize(getLayoutViewport())
}

/** Freeze responsive chrome during fullscreen, including iOS's native video player. */
export function observeScreenSize(onChange: (size: ScreenSize) => void) {
  // Page zoom changes both CSS viewport dimensions and devicePixelRatio. Use
  // the zoom level at mount as the baseline so Ctrl/Cmd +/- does not switch
  // responsive component trees (e.g. Dialog -> Drawer) and discard local state.
  // Actual window resizing still changes the normalized viewport dimensions.
  const initialPixelRatio = window.devicePixelRatio || 1
  let previousViewport = getLayoutViewport()
  let timer: ReturnType<typeof setTimeout> | undefined
  let nativeFullscreen = false
  const isFullscreen = () =>
    nativeFullscreen ||
    document.fullscreenElement ||
    (document as FullscreenDocument).webkitFullscreenElement ||
    Array.from(document.querySelectorAll('video')).some(
      (video) => (video as FullscreenVideo).webkitDisplayingFullscreen
    )

  const update = () => {
    if (!isFullscreen()) {
      const zoom = (window.devicePixelRatio || 1) / initialPixelRatio
      const viewport = getLayoutViewport(zoom)
      // CSS viewport dimensions are rounded by the browser. At fractional zoom
      // levels that rounding must not move a window across a nearby breakpoint.
      if (zoom !== 1) {
        for (const dimension of ['width', 'height'] as const) {
          if (Math.abs(viewport[dimension] - previousViewport[dimension]) <= Math.ceil(zoom)) {
            viewport[dimension] = previousViewport[dimension]
          }
        }
      }
      previousViewport = viewport
      onChange(classifyScreenSize(viewport))
    }
  }
  const scheduleUpdate = () => {
    clearTimeout(timer)
    // Rotation and fullscreen exit can deliver multiple intermediate viewport sizes.
    timer = setTimeout(update, 200)
  }
  const beginNativeFullscreen = () => {
    nativeFullscreen = true
    clearTimeout(timer)
  }
  const endNativeFullscreen = () => {
    nativeFullscreen = false
    scheduleUpdate()
  }

  window.addEventListener('resize', scheduleUpdate)
  window.addEventListener('orientationchange', scheduleUpdate)
  document.addEventListener('fullscreenchange', scheduleUpdate)
  document.addEventListener('webkitfullscreenchange', scheduleUpdate)
  // Native WebKit video events do not bubble.
  document.addEventListener('webkitbeginfullscreen', beginNativeFullscreen, true)
  document.addEventListener('webkitendfullscreen', endNativeFullscreen, true)
  update()

  return () => {
    clearTimeout(timer)
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('orientationchange', scheduleUpdate)
    document.removeEventListener('fullscreenchange', scheduleUpdate)
    document.removeEventListener('webkitfullscreenchange', scheduleUpdate)
    document.removeEventListener('webkitbeginfullscreen', beginNativeFullscreen, true)
    document.removeEventListener('webkitendfullscreen', endNativeFullscreen, true)
  }
}
