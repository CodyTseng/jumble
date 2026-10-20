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

export function getScreenSize(): ScreenSize {
  // Keep landscape phones compact, but let tablets use the sidebar even when
  // browser chrome temporarily reduces the visible height. The sidebar can scroll.
  const isSmallScreen = window.innerWidth <= 768 || getLayoutViewportHeight() <= 640
  return {
    isSmallScreen,
    isLargeScreen: !isSmallScreen && window.innerWidth >= 1280
  }
}

/** Freeze responsive chrome during fullscreen, including iOS's native video player. */
export function observeScreenSize(onChange: (size: ScreenSize) => void) {
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
    if (!isFullscreen()) onChange(getScreenSize())
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
