import { useFetchEventById } from '@renderer/hooks'
import { toNoStrudelNote } from '@renderer/lib/url'
import { Link } from 'react-router-dom'
import NoteCard from '../NoteCard'

export function EmbeddedNote({ noteId }: { noteId: string }) {
  const event = useFetchEventById(noteId)

  return event ? (
    <NoteCard className="mt-2 w-full" event={event} />
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
