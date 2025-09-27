import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import Collapsible from '../Collapsible'
import Note from '../Note'
import NoteStats from '../NoteStats'
import RepostDescription from './RepostDescription'

export default function MainNoteCard({
  event,
  className,
  reposter,
  embedded,
  originalNoteId
}: {
  event: Event
  className?: string
  reposter?: string
  embedded?: boolean
  originalNoteId?: string
}) {
  const { push } = useSecondaryPage()

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(originalNoteId ?? event))
      }}
    >
      <div className={`clickable ${embedded ? 'p-2 sm:p-3 border rounded-lg' : 'py-3'}`}>
        <Collapsible alwaysExpand={embedded}>
          <RepostDescription className={embedded ? '' : 'px-4'} reposter={reposter} />
          <Note
            className={embedded ? '' : 'px-4'}
            size={embedded ? 'small' : 'normal'}
            event={event}
            originalNoteId={originalNoteId}
          />
        </Collapsible>
        {!embedded && <NoteStats className="mt-3 px-4" event={event} displayTopZapsAndLikes={false} fetchIfNotExisting={true} />}
      </div>
      {!embedded && <Separator />}
    </div>
  )
}
