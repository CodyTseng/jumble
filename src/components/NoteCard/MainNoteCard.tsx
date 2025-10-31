import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import Collapsible from '../Collapsible'
import Note from '../Note'
import NoteStats from '../NoteStats'
import PinnedButton from './PinnedButton'
import RepostDescription from './RepostDescription'

export default function MainNoteCard({
  event,
  className,
  reposter,
  embedded,
  originalNoteId,
  pinned = false,
  hideSeparator = false
}: {
  event: Event
  className?: string
  reposter?: string
  embedded?: boolean
  originalNoteId?: string
  pinned?: boolean
  hideSeparator?: boolean
}) {
  const { push } = useSecondaryPage()

  return (
    <article
      className={className}
      onClick={(e) => {
        // Don't navigate if clicking on a button or interactive element
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('a')) {
          return
        }
        e.stopPropagation()
        push(toNote(originalNoteId ?? event))
      }}
      aria-label="Note"
    >
      <div
        className={cn('clickable group', embedded ? 'p-2 sm:p-3 border' : 'py-3')}
        style={embedded ? { borderRadius: 'var(--card-radius, 8px)' } : undefined}
      >
        <Collapsible alwaysExpand={embedded}>
          {pinned && <PinnedButton event={event} />}
          <RepostDescription className={embedded ? '' : 'px-4'} reposter={reposter} />
          <Note
            className={embedded ? '' : 'px-4'}
            size={embedded ? 'small' : 'normal'}
            event={event}
            originalNoteId={originalNoteId}
          />
        </Collapsible>
        {!embedded && <NoteStats className="mt-3 px-4" event={event} />}
      </div>
      {!embedded && !hideSeparator && <Separator />}
    </article>
  )
}
