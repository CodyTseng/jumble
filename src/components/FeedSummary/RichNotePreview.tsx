import NoteContent from '@/components/NoteContent'
import { cn } from '@/lib/utils'
import { NotePreviewProvider } from '@/providers/NotePreviewProvider'
import { Event } from 'nostr-tools'
import { useLayoutEffect, useRef, useState } from 'react'

export default function RichNotePreview({ event }: { event: Event }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return
    const measure = () => setClipped(content.scrollHeight > frame.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [event])

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative max-h-48 min-w-0 overflow-hidden',
        clipped && '[mask-image:linear-gradient(to_bottom,#000_calc(100%-2.5rem),transparent)]'
      )}
    >
      <div ref={contentRef} inert dir="auto" className="pointer-events-none flow-root min-w-0">
        <NotePreviewProvider>
          <NoteContent event={event} size="small" className="mt-0! text-base leading-relaxed" />
        </NotePreviewProvider>
      </div>
    </div>
  )
}
