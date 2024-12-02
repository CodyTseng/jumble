import { useFetchEvent } from '@renderer/hooks'
import { getParentEventId, getRootEventId } from '@renderer/lib/event'
import { toNote } from '@renderer/lib/link'
import { cn } from '@renderer/lib/utils'
import { useSecondaryPage } from '@renderer/PageManager'
import { Repeat2 } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import Note from '../Note'
import Username from '../Username'

export default function ShortTextNoteCard({
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
  const { push } = useSecondaryPage()
  const { event: rootEvent } = useFetchEvent(getRootEventId(event))
  const { event: parentEvent } = useFetchEvent(getParentEventId(event))

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(event.id))
      }}
    >
      <RepostDescription reposter={reposter} className="max-sm:hidden pl-4" />
      <div
        className={`hover:bg-muted/50 text-left cursor-pointer ${embedded ? 'p-3 border rounded-lg' : 'p-4 sm:border sm:rounded-lg max-sm:border-b'}`}
      >
        <RepostDescription reposter={reposter} className="sm:hidden" />
        <Note
          size={embedded ? 'small' : 'normal'}
          event={event}
          parentEvent={parentEvent ?? rootEvent}
          hideStats={embedded}
        />
      </div>
    </div>
  )
}

function RepostDescription({
  reposter,
  className
}: {
  reposter?: string | null
  className?: string
}) {
  const { t } = useTranslation()
  if (!reposter) return null

  return (
    <div className={cn('flex gap-1 text-sm items-center text-muted-foreground mb-1', className)}>
      <Repeat2 size={16} className="shrink-0" />
      <Username userId={reposter} className="font-semibold truncate" skeletonClassName="h-3" />
      <div>{t('reposted')}</div>
    </div>
  )
}
