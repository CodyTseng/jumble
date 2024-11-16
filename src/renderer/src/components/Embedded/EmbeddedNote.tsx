import { useFetchEventById } from '@renderer/hooks'
import { toNoStrudelNote } from '@renderer/lib/link'
import { kinds } from 'nostr-tools'
import ShortTextNoteCard from '../NoteCard/ShortTextNoteCard'

export function EmbeddedNote({ noteId }: { noteId: string }) {
  const { event } = useFetchEventById(noteId)

  return event && event.kind === kinds.ShortTextNote ? (
    <ShortTextNoteCard size="small" className="mt-2 w-full" event={event} hideStats />
  ) : (
    <a
      href={toNoStrudelNote(noteId)}
      target="_blank"
      className="text-highlight hover:underline"
      onClick={(e) => e.stopPropagation()}
      rel="noreferrer"
    >
      {noteId}
    </a>
  )
}
