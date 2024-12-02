import { useFetchEvent } from '@renderer/hooks'
import { toNoStrudelArticle, toNoStrudelNote, toNoStrudelStream } from '@renderer/lib/link'
import { kinds } from 'nostr-tools'
import ShortTextNoteCard from '../NoteCard/ShortTextNoteCard'

export function EmbeddedNote({ noteId }: { noteId: string }) {
  const { event } = useFetchEvent(noteId)

  return event && event.kind === kinds.ShortTextNote ? (
    <ShortTextNoteCard className="mt-2 w-full" event={event} embedded />
  ) : (
    <a
      href={
        event?.kind === kinds.LongFormArticle
          ? toNoStrudelArticle(noteId)
          : event?.kind === kinds.LiveEvent
            ? toNoStrudelStream(noteId)
            : toNoStrudelNote(noteId)
      }
      target="_blank"
      className="text-highlight hover:underline"
      onClick={(e) => e.stopPropagation()}
      rel="noreferrer"
    >
      {noteId}
    </a>
  )
}
