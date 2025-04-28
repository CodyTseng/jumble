import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Note from '../Note'
import NoteStats from '../NoteStats'
import RepostDescription from './RepostDescription'

export default function MainNoteCard({
  event,
  className,
  reposter,
  embedded
}: {
  event: Event
  className?: string
  reposter?: string
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [shouldCollapse, setShouldCollapse] = useState(false)

  useEffect(() => {
    if (embedded || shouldCollapse) return

    const contentEl = containerRef.current
    if (!contentEl) return

    const checkHeight = () => {
      const fullHeight = contentEl.scrollHeight
      if (fullHeight > 900) {
        setShouldCollapse(true)
      }
    }

    checkHeight()

    const observer = new ResizeObserver(() => {
      checkHeight()
    })

    observer.observe(contentEl)

    return () => {
      observer.disconnect()
    }
  }, [embedded, shouldCollapse])

  return (
    <div
      ref={containerRef}
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(event))
      }}
    >
      <div className={`clickable ${embedded ? 'p-2 sm:p-3 border rounded-lg' : 'py-3'}`}>
        <div
          className="relative text-left overflow-hidden"
          style={{
            maxHeight: !shouldCollapse || expanded ? 'none' : '600px'
          }}
        >
          <RepostDescription className={embedded ? '' : 'px-4'} reposter={reposter} />
          <Note
            className={embedded ? '' : 'px-4'}
            size={embedded ? 'small' : 'normal'}
            event={event}
          />
          {shouldCollapse && !expanded && (
            <div className="absolute bottom-0 h-20 w-full bg-gradient-to-b from-transparent to-muted flex items-center justify-center">
              <div className="bg-background rounded-md">
                <Button
                  className="bg-foreground hover:bg-foreground/80"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                >
                  {t('Show more')}
                </Button>
              </div>
            </div>
          )}
        </div>
        {!embedded && <NoteStats className={cn('mt-3', embedded ? '' : 'px-4')} event={event} />}
      </div>
      {!embedded && <Separator />}
    </div>
  )
}
