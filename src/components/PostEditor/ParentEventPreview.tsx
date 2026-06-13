import Note from '@/components/Note'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'

export default function ParentEventPreview({
  parentEvent,
  highlightedText,
  onClick
}: {
  parentEvent: Event
  highlightedText?: string
  onClick?: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setShowTopFade(scrollTop > 0)
      setShowBottomFade(scrollTop + clientHeight < scrollHeight - 1)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    Array.from(el.children).forEach((child) => ro.observe(child))

    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [parentEvent, highlightedText])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className={cn(
          'max-h-64 overflow-y-auto',
          onClick && 'cursor-pointer hover:bg-accent/30'
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="pointer-events-none px-5 py-3 sm:px-6">
          {highlightedText ? (
            <div className="flex gap-4">
              <div className="my-1 w-1 shrink-0 rounded-md bg-primary/60" />
              <div className="whitespace-pre-line italic">{highlightedText}</div>
            </div>
          ) : (
            <Note size="small" event={parentEvent} hideParentNotePreview />
          )}
        </div>
      </div>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background to-transparent transition-opacity duration-200',
          showTopFade ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent transition-opacity duration-200',
          showBottomFade ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  )
}
