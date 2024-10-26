import { Event } from 'nostr-tools'
import { kinds } from 'nostr-tools'
import RepostNoteCard from './RepostNoteCard'
import ShortTextNoteCard from './ShortTextNoteCard'

export default function NoteCard({ event, className }: { event: Event; className?: string }) {
  if (event.kind === kinds.Repost) {
    return <RepostNoteCard event={event} className={className} />
  }
  return <ShortTextNoteCard event={event} className={className} />
}
