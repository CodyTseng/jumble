import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import modalManager from '@/services/modal-manager.service'

// A responsive modal built on Radix Dialog. The same portal/content tree renders
// a bottom sheet on small screens and a centered dialog on larger screens.
// Explicit directions are reserved for anchored navigation sheets.
// Keyboard avoidance and swipe dismissal are enabled only for bottom sheets.

type TModalDirection = 'bottom' | 'left' | 'right' | 'center'

type TModalContext = {
  direction: TModalDirection
  closeModal: () => void
}

const ModalContext = React.createContext<TModalContext>({
  direction: 'bottom',
  closeModal: () => {}
})

type ModalProps = {
  children?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  direction?: TModalDirection
  modal?: boolean
}

const Modal = ({
  children,
  open,
  defaultOpen,
  onOpenChange,
  direction: requestedDirection,
  modal = true
}: ModalProps) => {
  const { isSmallScreen } = useScreenSize()
  const direction = requestedDirection ?? (isSmallScreen ? 'bottom' : 'center')
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen ?? false)
  const id = React.useId()
  const isControlled = open !== undefined
  const effectiveOpen = open ?? innerOpen

  React.useEffect(() => {
    if (!effectiveOpen) return
    let active = true
    modalManager.register(id, () => {
      if (active) handleOpenChangeRef.current(false)
    })
    return () => {
      // unregister also invokes its callback; cleanup must not request a second close.
      active = false
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
      if (!isControlled) setInnerOpen(value)
      onOpenChange?.(value)
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
  const closeModal = React.useCallback(() => handleOpenChangeRef.current(false), [])

  const contextValue = React.useMemo(() => ({ direction, closeModal }), [direction, closeModal])

  return (
    <ModalContext.Provider value={contextValue}>
      <DialogPrimitive.Root open={effectiveOpen} onOpenChange={handleOpenChange} modal={modal}>
        {children}
      </DialogPrimitive.Root>
    </ModalContext.Provider>
  )
}
Modal.displayName = 'Modal'

const ModalTrigger = DialogPrimitive.Trigger
const ModalClose = DialogPrimitive.Close

export const MODAL_DIRECTION_CLASS: Record<TModalDirection, string> = {
  // A centered presentation uses the same portal/content tree as the sheets,
  // allowing stateful content to survive responsive presentation changes.
  center:
    'left-[50%] top-[50%] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border shadow-lg ' +
    'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
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

type ModalContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * Accessible name rendered as a visually-hidden DialogTitle. Required by
   * Radix Dialog for screen readers when no visible <ModalTitle> is rendered
   * inside the content. Defaults to 'Dialog'.
   */
  title?: string
  /**
   * Hide the swipe-down grab handle (only relevant for direction="bottom").
   */
  hideHandle?: boolean
  /** Layout, padding and overflow of the content region, separate from the modal frame. */
  bodyClassName?: string
  /** Show the desktop close control. Mobile sheets use swipe/outside dismissal. */
  withoutClose?: boolean
}

// Titles nested in layout elements still use Radix's shared title id. Only
// provide a hidden fallback when callers haven't supplied their own title.
function hasModalTitle(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return false
    return (
      (child.type as { displayName?: string }).displayName === DialogPrimitive.Title.displayName ||
      hasModalTitle(child.props.children)
    )
  })
}

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  (
    {
      className,
      bodyClassName,
      children,
      title,
      hideHandle,
      withoutClose = true,
      onPointerDownOutside,
      onOpenAutoFocus,
      ...props
    },
    ref
  ) => {
    const { direction, closeModal } = React.useContext(ModalContext)
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
      onClose: closeModal
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
          data-modal-presentation={direction}
          // Don't grab focus on open — focusing the first input would immediately
          // resurrect the soft keyboard we just dismissed.
          onOpenAutoFocus={(e) => {
            onOpenAutoFocus?.(e)
            if (!e.defaultPrevented && direction !== 'center') e.preventDefault()
          }}
          onPointerDownOutside={onPointerDownOutside}
          className={cn(
            'safe-area-x-margin bg-background fixed z-50 flex flex-col outline-hidden',
            direction === 'center' && 'max-h-[90dvh]',
            MODAL_DIRECTION_CLASS[direction],
            className,
            // The frame never scrolls or takes caller content padding/layout.
            'flex flex-col gap-0 overflow-hidden p-0',
            direction !== 'center' &&
              (direction === 'bottom'
                ? 'pb-[calc(env(safe-area-inset-bottom)+1rem)]'
                : 'pb-[env(safe-area-inset-bottom)]'),
            direction === 'bottom' &&
              'inset-x-0 top-auto w-auto max-w-none translate-x-0 translate-y-0'
          )}
          {...props}
        >
          {/* sr-only Title so Radix accessibility checks pass. Visible titles
              come from <ModalTitle> rendered inside `children`. */}
          {!hasModalTitle(children) && (
            <DialogPrimitive.Title className="sr-only">{title ?? 'Dialog'}</DialogPrimitive.Title>
          )}
          {direction === 'bottom' && !hideHandle && (
            <div data-modal-handle className="flex h-9 shrink-0 justify-center pt-3">
              <div className="bg-muted h-1.5 w-12 rounded-full" />
            </div>
          )}
          <div
            data-modal-body
            className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', bodyClassName)}
          >
            {children}
          </div>
          {direction === 'center' && !withoutClose && (
            <DialogPrimitive.Close className="hover:bg-accent focus:ring-ring absolute top-5 right-5 flex size-8 items-center justify-center rounded-lg opacity-70 transition-colors hover:opacity-100 focus:ring-2 focus:outline-hidden disabled:pointer-events-none">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }
)
ModalContent.displayName = 'ModalContent'

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg leading-none font-semibold tracking-tight', className)}
    {...props}
  />
))
ModalTitle.displayName = DialogPrimitive.Title.displayName

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
))
ModalDescription.displayName = DialogPrimitive.Description.displayName

export { Modal, ModalClose, ModalContent, ModalDescription, ModalTitle, ModalTrigger }

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
export function useVisualViewportInset(el: HTMLElement | null, enabled: boolean) {
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
 * the whole content surface and defers to scrollable containers (including itself):
 *
 *   - Upward swipes: never engage; the inner scroll runs as usual.
 *   - Downward swipes starting inside a scrolled element: the scroll wins.
 *   - Downward swipes starting elsewhere (or in a scrollable already at
 *     scrollTop=0): engage drag mode, follow the pointer, dismiss on release
 *     past a distance or velocity threshold.
 *
 * Native touch listeners (not React handlers) are required because we need
 * a non-passive `touchmove` to `preventDefault` once the drag engages —
 * React synthetic touch handlers are passive in modern React. Mouse moves and
 * releases are tracked on the document so dragging can leave the drawer.
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
  const [closeAttempt, setCloseAttempt] = React.useState(0)
  // A caller can reject dismissal or open a confirmation without changing open.
  // Force a commit, then inspect Radix's committed state before the next paint.
  // Accepted closes keep their offset for the exit animation.
  React.useLayoutEffect(() => {
    if (!closeAttempt || !contentEl || contentEl.dataset.state !== 'open') return
    contentEl.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
    contentEl.style.transform = ''
  }, [closeAttempt, contentEl])

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
      while (cur) {
        if (cur.nodeType === 1 && isScrollable(cur)) return cur
        // The modal surface may own scrolling; include it, but stop before the page.
        if (cur === el) break
        cur = cur.parentElement
      }
      return null
    }

    let mouseActive = false

    const startDrag = (target: EventTarget | null, y: number) => {
      if (target instanceof Element && target.closest('[data-drawer-swipe-lock]')) return
      startY = y
      lastY = y
      lastTime = performance.now()
      velocity = 0
      armed = true
      dragging = false
      scrollableAtStart = findScrollableAncestor(target)
    }

    const moveDrag = (y: number, e: Event) => {
      if (!armed) return
      const delta = y - startY

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
      if (dt > 0) velocity = (y - lastY) / dt
      lastY = y
      lastTime = now
    }

    const endDrag = (y: number) => {
      const wasDragging = dragging
      armed = false
      dragging = false
      scrollableAtStart = null
      if (!wasDragging) return

      const delta = y - startY
      // ~25% of drawer height (min 80px) OR a clear downward flick.
      const closeByDistance = delta > Math.max(el.offsetHeight * 0.25, 80)
      const closeByVelocity = velocity > 0.6
      if (closeByDistance || closeByVelocity) {
        // The exit keyframes only specify the destination. Keep the current
        // transform as their starting point until Radix unmounts the content.
        el.style.transition = ''
        onCloseRef.current()
        setCloseAttempt((attempt) => attempt + 1)
      } else {
        el.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
        el.style.transform = ''
      }
    }

    const cancelDrag = () => {
      if (dragging) {
        el.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'
        el.style.transform = ''
      }
      armed = false
      dragging = false
      scrollableAtStart = null
    }

    const onTouchStart = (e: TouchEvent) => {
      cancelDrag()
      mouseActive = false
      if (e.touches.length === 1) startDrag(e.target, e.touches[0].clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) moveDrag(e.touches[0].clientY, e)
    }
    const onTouchEnd = (e: TouchEvent) => endDrag(e.changedTouches[0]?.clientY ?? startY)

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || armed || e.defaultPrevented) return
      // Keep text fields, links, controls and sortable handles usable.
      if (
        e.target instanceof Element &&
        e.target.closest(
          'button, a, input, textarea, select, [role="button"], [contenteditable]:not([contenteditable="false"]), [data-drawer-swipe-lock]'
        )
      )
        return
      startDrag(e.target, e.clientY)
      mouseActive = armed
      // Prevent text selection and native image dragging during the gesture.
      if (mouseActive) e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseActive) return
      if (!(e.buttons & 1)) {
        onMouseCancel()
        return
      }
      moveDrag(e.clientY, e)
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!mouseActive || e.button !== 0) return
      mouseActive = false
      endDrag(e.clientY)
    }
    const onMouseCancel = () => {
      if (!mouseActive) return
      mouseActive = false
      cancelDrag()
    }
    const doc = el.ownerDocument
    const view = doc.defaultView
    el.addEventListener('mousedown', onMouseDown)
    doc.addEventListener('mousemove', onMouseMove)
    doc.addEventListener('mouseup', onMouseUp)
    view?.addEventListener('blur', onMouseCancel)

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    // touchmove must be non-passive so we can preventDefault once the drag
    // engages and stop the page from scrolling underneath us.
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', cancelDrag, { passive: true })

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      doc.removeEventListener('mousemove', onMouseMove)
      doc.removeEventListener('mouseup', onMouseUp)
      view?.removeEventListener('blur', onMouseCancel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', cancelDrag)
      el.style.transform = ''
      el.style.transition = ''
    }
  }, [enabled, contentEl])
}
