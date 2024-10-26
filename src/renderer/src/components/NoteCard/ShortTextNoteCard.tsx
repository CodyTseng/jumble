import { Event } from 'nostr-tools'
import { Card } from '@renderer/components/ui/card'
import { toNote } from '@renderer/lib/url'
import { useSecondaryPage } from '@renderer/PageManager'
import Note from '../Note'

export default function ShortTextNoteCard({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { push } = useSecondaryPage()

  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        push(toNote(event.id))
      }}
    >
      <Card className="p-4 hover:bg-muted/50 text-left cursor-pointer">
        <Note event={event} />
      </Card>
    </div>
  )
}
