import SuggestedEmojis from '@/components/SuggestedEmojis'
import { cn } from '@/lib/utils'
import { TEmoji } from '@/types'
import { Copy, Reply } from 'lucide-react'
import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

const GAP = 8
const MARGIN = 12

/**
 * iOS/Telegram-style long-press context menu for DM bubbles (touch only).
 *
 * Renders a full-screen blurred backdrop, lifts a clone of the pressed bubble
 * above it, floats a quick-reaction bar on top and an action menu below. The
 * group is clamped vertically so both stay on screen near the top/bottom edge;
 * when the message is too tall to fit, the reaction bar and menu drop together
 * below a height-capped (clipped) bubble instead.
 */
export default function MessageContextMenu({
  originRect,
  onReply,
  onCopy,
  onReact,
  onMore,
  onClose,
  children
}: {
  originRect: DOMRect
  onReply: () => void
  onCopy: () => void
  onReact: (emoji: string | TEmoji) => void
  onMore: () => void
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const reactionRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Tracks whether a fresh press has started on this overlay. The long-press
  // that opens the menu has its pointerdown on the bubble (before this overlay
  // mounts), so it never sets this — letting us swallow that gesture's trailing
  // synthesized click instead of treating it as a dismiss/selection tap.
  const pressStartedOnOverlayRef = useRef(false)
  const [layout, setLayout] = useState<{
    bubbleTop: number
    reactionTop: number
    menuTop: number
    bubbleMaxHeight?: number
  }>({ bubbleTop: originRect.top, reactionTop: originRect.top, menuTop: originRect.top })

  // Place the three floating pieces so they all stay on screen. Runs before
  // paint, so the first painted frame is final.
  //
  // - Normal: reaction bar above the bubble, menu below, with the bubble clamped
  //   vertically for messages near the top/bottom edge.
  // - Tall content (the whole stack can't fit): co-locate the reaction bar and
  //   menu below a height-capped bubble, so both controls remain reachable. The
  //   bubble's content is simply clipped — showing it in full isn't required.
  useLayoutEffect(() => {
    const reactionHeight = reactionRef.current?.offsetHeight ?? 0
    const menuHeight = menuRef.current?.offsetHeight ?? 0
    const top = MARGIN
    const bottom = window.innerHeight - MARGIN
    const availHeight = bottom - top
    const fullStackHeight = reactionHeight + GAP + originRect.height + GAP + menuHeight

    if (fullStackHeight <= availHeight) {
      const minTop = top + reactionHeight + GAP
      const maxTop = bottom - menuHeight - GAP - originRect.height
      const bubbleTop = Math.min(Math.max(originRect.top, minTop), maxTop)
      setLayout({
        bubbleTop,
        reactionTop: bubbleTop - GAP - reactionHeight,
        menuTop: bubbleTop + originRect.height + GAP
      })
    } else {
      const bubbleMaxHeight = Math.max(80, availHeight - reactionHeight - menuHeight - 2 * GAP)
      const reactionTop = top + bubbleMaxHeight + GAP
      setLayout({
        bubbleTop: top,
        reactionTop,
        menuTop: reactionTop + reactionHeight + GAP,
        bubbleMaxHeight
      })
    }
  }, [originRect])

  // Esc to close + lock background scroll while open. (Back-button dismissal is
  // wired up via modalManager in the parent MessageBubble — registering here
  // would misfire under StrictMode's mount/cleanup/mount cycle, because
  // modalManager.unregister invokes the close callback on cleanup.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // Pin every floating piece to whichever screen edge the bubble sits nearer,
  // so the reaction bar / menu grow inward and mirror own-vs-peer layouts.
  // Deriving the side from the measured rect (not isOwn) keeps it correct under
  // RTL, where own messages render on the left. Physical right/left is
  // intentional here — we anchor to a screen edge, not to content flow.
  const pinRight = originRect.left + originRect.width / 2 > window.innerWidth / 2
  const sideStyle: CSSProperties = pinRight
    ? { right: Math.max(MARGIN, window.innerWidth - originRect.right) }
    : { left: Math.max(MARGIN, originRect.left) }

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onPointerDownCapture={() => {
        pressStartedOnOverlayRef.current = true
      }}
      onClickCapture={(e) => {
        // Swallow the trailing click synthesized by the opening long-press —
        // no press has started on the overlay yet, so this click isn't a real
        // dismiss/selection. Without this the menu "flashes" and closes at once.
        if (!pressStartedOnOverlayRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onClick={onClose}
    >
      <div className="bg-background/60 animate-in fade-in-0 absolute inset-0 backdrop-blur-sm duration-150" />

      {/* Quick-reaction bar */}
      <div
        ref={reactionRef}
        className="bg-popover animate-in fade-in-0 zoom-in-95 fixed flex max-w-[calc(100vw-24px)] items-center overflow-x-auto rounded-full border shadow-lg duration-150"
        style={{ top: layout.reactionTop, ...sideStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <SuggestedEmojis
          onEmojiClick={(emoji) => {
            onReact(emoji)
            onClose()
          }}
          onMoreButtonClick={onMore}
        />
      </div>

      {/* Lifted bubble clone (content is clipped when the message is too tall).
          No zoom-in here on purpose: the clone re-runs MeasuredTextBubble, whose
          getClientRects-based measurement happens in a layout effect while the
          entrance transform is still at scale(.95). A scaled measurement sets a
          too-narrow width and the text wraps for good (ResizeObserver watches the
          parent, which a transform never resizes, so it never re-measures). Fade
          only — the reaction bar / menu still zoom since they don't self-measure. */}
      <div
        className="animate-in fade-in-0 fixed overflow-hidden duration-150"
        style={{
          // +1px of slack absorbs sub-pixel rounding so a single line never wraps.
          top: layout.bubbleTop,
          width: Math.ceil(originRect.width) + 1,
          maxHeight: layout.bubbleMaxHeight,
          ...sideStyle
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>

      {/* Action menu */}
      <div
        ref={menuRef}
        className="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 fixed flex w-44 flex-col overflow-hidden rounded-xl border shadow-lg duration-150"
        style={{ top: layout.menuTop, ...sideStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            onReply()
            onClose()
          }}
          className={menuItemClass}
        >
          <Reply className="text-muted-foreground h-5 w-5 shrink-0" />
          {t('Reply')}
        </button>
        <div className="bg-border h-px" />
        <button
          onClick={() => {
            onCopy()
            onClose()
          }}
          className={menuItemClass}
        >
          <Copy className="text-muted-foreground h-5 w-5 shrink-0" />
          {t('Copy')}
        </button>
      </div>
    </div>,
    document.body
  )
}

const menuItemClass = cn('hover:bg-accent flex items-center gap-3 px-4 py-3 text-start text-base')
