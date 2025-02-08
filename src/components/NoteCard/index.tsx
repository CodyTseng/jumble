import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import NormalNoteCard from './NormalNoteCard'
import RepostNoteCard from './RepostNoteCard'

export default function NoteCard({
  event,
  className,
  filterMutedNotes = true
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
}) {
  const { mutePubkeys } = useMuteList()
  if (filterMutedNotes && mutePubkeys.includes(event.pubkey)) {
    return null
  }

  if (event.kind === kinds.Repost) {
    return (
      <RepostNoteCard event={event} className={className} filterMutedNotes={filterMutedNotes} />
    )
  }
  return <NormalNoteCard event={event} className={className} />
}
