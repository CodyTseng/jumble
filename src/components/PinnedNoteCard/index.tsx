import { useFetchEvent } from '@/hooks'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'

export default function PinnedNoteCard({
  eventId,
  className
}: {
  eventId: string
  className?: string
}) {
  const { event, isFetching } = useFetchEvent(eventId)

  if (isFetching) {
    return <NoteCardLoadingSkeleton />
  }

  if (!event) {
    return null
  }

  return <NoteCard event={event} className={className} pinned />
}
