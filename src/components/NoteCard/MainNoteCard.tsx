import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import Note from '../Note'
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
  const { push } = useSecondaryPage()
  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(event))
      }}
    >
      <div
        className={`clickable text-left ${embedded ? 'p-2 sm:p-3 border rounded-lg' : 'px-4 py-3'}`}
      >
        <RepostDescription reposter={reposter} />
        <Note size={embedded ? 'small' : 'normal'} event={event} hideStats={embedded} />
      </div>
      {!embedded && <Separator />}
    </div>
  )
}
