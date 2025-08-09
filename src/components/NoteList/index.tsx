import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import NoteCard from '../NoteCard'

export default function NoteList({
  events,
  filterMutedNotes
}: {
  events: Event[]
  filterMutedNotes?: boolean
}) {
  const idSet = new Set<string>()

  return (
    <div>
      {events.map((event) => {
        const id = isReplaceableEvent(event.kind)
          ? getReplaceableCoordinateFromEvent(event)
          : event.id

        if (idSet.has(id)) {
          return null
        }

        idSet.add(id)
        return (
          <NoteCard
            key={event.id}
            className="w-full"
            event={event}
            filterMutedNotes={filterMutedNotes}
          />
        )
      })}
    </div>
  )
}
