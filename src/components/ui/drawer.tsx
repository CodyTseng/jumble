import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

import { cn } from '@/lib/utils'
import modalManager from '@/services/modal-manager.service'

// A bottom/side sheet built on Radix Dialog. Replaces vaul. The goals:
//   * Virtual keyboards never cover the content (`useVisualViewportInset`).
//   * Opening the drawer while a textarea is focused dismisses that focus
//     so the OS keyboard collapses cleanly — solves the "open emoji picker
//     after typing → drawer dies on first touch" issue we hit with vaul.
//   * Swipe-down-to-close gesture lives on the whole content surface but
//     defers to inner scrollable lists (see `useVerticalDragToClose`).
//   * No DrawerHeader/Footer/Overlay/Portal exports — callers compose
//     whatever markup they want inside DrawerContent.

type TDrawerDirection = 'bottom' | 'left' | 'right'

type TDrawerContext = {
  direction: TDrawerDirection
  closeDrawer: () => void
}

const DrawerContext = React.createContext<TDrawerContext>({
  direction: 'bottom',
  closeDrawer: () => {}
})

type DrawerProps = {
  children?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  direction?: TDrawerDirection
  modal?: boolean
}

const Drawer = ({
  children,
  open,
  defaultOpen,
  onOpenChange,
  direction = 'bottom',
  modal = true
}: DrawerProps) => {
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen ?? false)
  const id = React.useId()
  const isControlled = open !== undefined
  const effectiveOpen = open ?? innerOpen

  // Keep the latest callbacks in refs so the modalManager effect only re-runs
  // on actual open/close transitions, not on every parent re-render that
  // hands us a fresh inline `onOpenChange`.
  const isControlledRef = React.useRef(isControlled)
  const onOpenChangeRef = React.useRef(onOpenChange)
  React.useEffect(() => {
    isControlledRef.current = isControlled
    onOpenChangeRef.current = onOpenChange
  })

  React.useEffect(() => {
    if (!effectiveOpen) return
    modalManager.register(id, () => {
      if (isControlledRef.current) onOpenChangeRef.current?.(false)
      else setInnerOpen(false)
    })
    return () => {
      modalManager.unregister(id)
    }
  }, [effectiveOpen, id])

  const handleOpenChange = React.useCallback(
    (value: boolean) => {
      // Bottom drawers may open from inside a focused text field (tapping the
      // expression picker while a textarea has the OS keyboard up). Blurring
      // lets the keyboard slide down before the drawer measures itself.
      // Side drawers don't have this layout interaction, so leave focus alone.
      if (value && direction === 'bottom' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      if (isControlled) onOpenChange?.(value)
      else setInnerOpen(value)
    },
    [isControlled, onOpenChange, direction]
  )

  // Stable across renders — depending on the latest handleOpenChange ref keeps
  // the context value memoization meaningful even when callers pass inline
  // onOpenChange functions.
  const handleOpenChangeRef = React.useRef(handleOpenChange)
  React.useEffect(() => {
    handleOpenChangeRef.current = handleOpenChange
  })
  const closeDrawer = React.useCallback(() => handleOpenChangeRef.current(false), [])

  const contextValue = React.useMemo(() => ({ direction, closeDrawer }), [direction, closeDrawer])

  return (
    <DrawerContext.Provider value={contextValue}>
      <DialogPrimitive.Root open={effectiveOpen} onOpenChange={handleOpenChange} modal={modal}>
        {children}
      </DialogPrimitive.Root>
    </DrawerContext.Provider>
  )
}
Drawer.displayName = 'Drawer'

const DrawerTrigger = DialogPrimitive.Trigger
const DrawerClose = DialogPrimitive.Close

const DIRECTION_CLASS: Record<TDrawerDirection, string> = {
  bottom:
    'inset-x-0 bottom-0 max-h-[calc(100dvh-2rem)] rounded-t-2xl border-t ' +
    'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
    'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
  left:
    'inset-y-0 start-0 h-full w-[85%] max-w-sm rounded-e-2xl border-e ' +
    'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
    'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left ' +
    'rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right',
  right:
    'inset-y-0 end-0 h-full w-[85%] max-w-sm rounded-s-2xl border-s ' +
    'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
    'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right ' +
    'rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left'
}

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * Accessible name rendered as a visually-hidden DialogTitle. Required by
   * Radix Dialog for screen readers when no visible <DrawerTitle> is rendered
   * inside the content. Defaults to 'Drawer'.
   */
  title?: string
  /**
   * Hide the swipe-down grab handle (only relevant for direction="bottom").
   */
  hideHandle?: boolean
}

const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(
  ({ className, children, title, hideHandle, onPointerDownOutside, ...props }, ref) => {
    const { direction, closeDrawer } = React.useContext(DrawerContext)
    // Callback ref + state, not useRef: Radix Dialog re-mounts Content on
    // every open, so our hooks must re-bind their native listeners to the
    // *new* DOM node. A plain ref object has stable identity and wouldn't
    // re-trigger the hook effects.
    const [contentEl, setContentEl] = React.useState<HTMLDivElement | null>(null)
    const setRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        setContentEl(node)
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref]
    )

    useVisualViewportInset(contentEl, direction === 'bottom')

    useVerticalDragToClose({
      contentEl,
      enabled: direction === 'bottom',
      onClose: closeDrawer
    })

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/80',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          ref={setRef}
          // Don't grab focus on open — focusing the first input would immediately
          // resurrect the soft keyboard we just dismissed.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={onPointerDownOutside}
          className={cn(
            'bg-background fixed z-50 flex flex-col outline-hidden',
            DIRECTION_CLASS[direction],
            // Standard bottom inset for every drawer so callers never have to
            // tack on their own pb-*. Bottom drawers add 1rem of visual
            // breathing room above the safe-area; side drawers only need the
            // safe-area itself since their content fills full height.
            direction === 'bottom'
              ? 'pb-[calc(env(safe-area-inset-bottom)+1rem)]'
              : 'pb-[env(safe-area-inset-bottom)]',
            className
          )}
          {...props}
        >
          {/* sr-only Title so Radix accessibility checks pass. Visible titles
              come from <DrawerTitle> rendered inside `children`. */}
          <DialogPrimitive.Title className="sr-only">{title ?? 'Drawer'}</DialogPrimitive.Title>
          {direction === 'bottom' && !hideHandle && (
            <div className="flex shrink-0 justify-center py-3">
              <div className="bg-muted h-1.5 w-12 rounded-full" />
            </div>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }
)
DrawerContent.displayName = 'DrawerContent'

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg leading-none font-semibold tracking-tight', className)}
    {...props}
  />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger }

// =============================================================================
// Internal hooks
// =============================================================================

/**
 * Lift a bottom drawer just enough to clear the focused input from the
 * on-screen keyboard. Reserving the full keyboard height (vaul's default)
 * pushes the drawer's top off-screen on tall drawers and wastes vertical
 * room when the input is already visible.
 *
 * Strategy:
 *   - No keyboard or no focused editable inside the drawer → no offset.
 *   - Focused input already above the keyboard → no offset.
 *   - Focused input intersects the keyboard → shift the drawer up by exactly
 *     the overlap (plus a small safety margin), nothing more.
 *
 * Driven by `visualViewport.resize/scroll` and `focusin/focusout` so we
 * recompute whenever either the keyboard or the active field changes.
 */
function useVisualViewportInset(el: HTMLElement | null, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || !el) return
    const vv = window.visualViewport
    if (!vv) return

    const apply = () => {
      const active = document.activeElement as HTMLElement | null
      const isEditable =
        !!active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      // Fast path: no editable focus inside this drawer means no possible
      // overlap. Most drawers (menus, pickers, confirmations) never hit the
      // measurement path even though they share these listeners.
      if (!isEditable || !el.contains(active)) {
        if (el.style.bottom) el.style.bottom = ''
        return
      }
      const keyboardHeight = Math.max(window.innerHeight - vv.height - vv.offsetTop, 0)
      if (keyboardHeight === 0) {
        if (el.style.bottom) el.style.bottom = ''
        return
      }
      // visible viewport bottom in layout-viewport coords; anything below it
      // is hidden by the keyboard.
      const visibleBottom = vv.offsetTop + vv.height
      const inputBottom = active.getBoundingClientRect().bottom
      const SAFETY_MARGIN = 12
      const overlap = inputBottom + SAFETY_MARGIN - visibleBottom
      el.style.bottom = overlap > 0 ? `${overlap}px` : ''
    }

    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    document.addEventListener('focusin', apply)
    document.addEventListener('focusout', apply)
    apply()

    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.removeEventListener('focusin', apply)
      document.removeEventListener('focusout', apply)
      el.style.bottom = ''
    }
  }, [enabled, el])
}

/**
 * Swipe-down-to-close gesture for `direction="bottom"` drawers. Lives on
 * the whole content surface and defers to inner scrollable lists:
 *
 *   - Upward swipes: never engage; the inner scroll runs as usual.
 *   - Downward swipes starting inside a scrolled element: the scroll wins.
 *   - Downward swipes starting elsewhere (or in a scrollable already at
 *     scrollTop=0): engage drag mode, follow the finger, dismiss on release
 *     past a distance or velocity threshold.
 *
 * Native touch listeners (not React handlers) are required because we need
 * a non-passive `touchmove` to `preventDefault` once the drag engages —
 * React synthetic touch handlers are passive in modern React.
 */
function useVerticalDragToClose({
  contentEl,
  enabled,
  onClose
}: {
  contentEl: HTMLElement | null
  enabled: boolean
  onClose: () => void
}) {
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    if (!enabled || !contentEl) return
    const el = contentEl

    // Closure state (intentionally not refs — confined to this effect run).
    let startY = 0
    let lastY = 0
    let lastTime = 0
    let velocity = 0
    let armed = false
    let dragging = false
    let scrollableAtStart: HTMLElement | null = null

    // Cheap scrollHeight comparison first; getComputedStyle forces layout and
    // is what we want to avoid for the common case where the touched node
    // can't possibly scroll.
    const isScrollable = (node: HTMLElement) => {
      if (node.scrollHeight <= node.clientHeight) return false
      const oy = getComputedStyle(node).overflowY
      return oy === 'auto' || oy === 'scroll'
    }

    const findScrollableAncestor = (target: EventTarget | null): HTMLElement | null => {
      let cur = target as HTMLElement | null
      while (cur && cur !== el) {
        if (cur.nodeType === 1 && isScrollable(cur)) return cur
        cur = cur.parentElement
      }
      return null
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        // Multi-touch: cancel any in-flight drag so pinch etc. work cleanly.
        armed = false
        dragging = false
        return
      }
      const touch = e.touches[0]
      startY = touch.clientY
      lastY = startY
      lastTime = performance.now()
      velocity = 0
      armed = true
      dragging = false
      scrollableAtStart = findScrollableAncestor(e.target)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!armed || e.touches.length !== 1) return
      const touch = e.touches[0]
      const delta = touch.clientY - startY

      if (!dragging) {
        // Don't engage drag for upward / negligible motion — leaves the
        // inner scroll responsive to small touch jitter.
        if (delta <= 8) return
        // If the gesture starts inside something that's already scrolled,
        // the inner scroll owns the gesture, not the drawer.
        if (scrollableAtStart && scrollableAtStart.scrollTop > 0) return

        dragging = true
        el.style.transition = 'none'
      }

      // Past this point we own the gesture; suppress native scrolling so
      // the drawer translation isn't fighting with overflow scroll.
      e.preventDefault()

      el.style.transform = `translate3d(0, ${delta}px, 0)`

      const now = performance.now()
      const dt = now - lastTime
      if (dt > 0) velocity = (touch.clientY - lastY) / dt
      lastY = touch.clientY
      lastTime = now
    }

    const onTouchEnd = (e: TouchEvent) => {
      const wasDragging = dragging
      armed = false
      dragging = false
      scrollableAtStart = null
      if (!wasDragging) return

      const lastTouch = e.changedTouches[0]
      const delta = lastTouch ? lastTouch.clientY - startY : 0
      // ~25% of drawer height (min 80px) OR a clear downward flick.
      const closeByDistance = delta > Math.max(el.offsetHeight * 0.25, 80)
      const closeByVelocity = velocity > 0.6
      if (closeByDistance || closeByVelocity) {
        // Hand off to Radix's exit animation; clearing the transform lets it
        // animate from rest position rather than from the drag offset.
        el.style.transition = ''
        el.style.transform = ''
        onCloseRef.current()
      } else {
        el.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
        el.style.transform = ''
      }
    }

    const onTouchCancel = () => {
      if (dragging) {
        el.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
        el.style.transform = ''
      }
      armed = false
      dragging = false
      scrollableAtStart = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    // touchmove must be non-passive so we can preventDefault once the drag
    // engages and stop the page from scrolling underneath us.
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled, contentEl])
}
