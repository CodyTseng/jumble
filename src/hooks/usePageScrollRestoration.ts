import { RefObject, useLayoutEffect, useRef } from 'react'

type ScrollPosition = {
  top: number
  anchor?: Element
  offset?: number
}

/** Transfer a page's reading position between window and panel scrolling without reparenting it. */
export function usePageScrollRestoration({
  active,
  windowScroll,
  scrollAreaRef,
  resetKey
}: {
  active: boolean
  windowScroll: boolean
  scrollAreaRef: RefObject<HTMLDivElement>
  resetKey?: string | null
}) {
  const position = useRef<ScrollPosition>({ top: 0 })
  const previousMode = useRef(windowScroll)

  useLayoutEffect(() => {
    position.current = { top: 0 }
  }, [resetKey])

  useLayoutEffect(() => {
    const modeChanged = previousMode.current !== windowScroll
    if (!active) return
    previousMode.current = windowScroll
    const viewport = scrollAreaRef.current
    if (!viewport) return
    const target = windowScroll ? window : viewport
    const getTop = () => (windowScroll ? window.scrollY : viewport.scrollTop)
    const getViewportTop = () => (windowScroll ? 0 : viewport.getBoundingClientRect().top)
    const saved = position.current

    const restore = () => {
      let top = saved.top
      if (
        modeChanged &&
        saved.top > 0 &&
        saved.anchor?.isConnected &&
        viewport.contains(saved.anchor)
      ) {
        top =
          getTop() +
          saved.anchor.getBoundingClientRect().top -
          getViewportTop() -
          (saved.offset ?? 0)
      }
      // A former panel offset must not scroll its children inside window-scroll mode.
      if (windowScroll) viewport.scrollTop = 0
      target.scrollTo({ top, behavior: 'instant' })
    }
    restore()
    // Safari may clamp or re-adjust window scroll just after the outgoing page is hidden.
    let restoring = true
    const raf = requestAnimationFrame(() => {
      restore()
      restoring = false
      remember()
    })

    function remember() {
      if (restoring) return
      const top = getTop()
      const viewportTop = getViewportTop()
      const anchor = Array.from(viewport!.querySelectorAll('[data-clickable-card]')).find(
        (element) => element.getBoundingClientRect().bottom > viewportTop + 48
      )
      position.current = {
        top,
        anchor,
        offset: anchor ? anchor.getBoundingClientRect().top - viewportTop : undefined
      }
    }
    target.addEventListener('scroll', remember, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('scroll', remember)
    }
  }, [active, windowScroll, scrollAreaRef])
}
