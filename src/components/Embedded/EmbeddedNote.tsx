import { PICTURE_EVENT_KIND } from '@/constants'
import { useFetchEvent } from '@/hooks'
import { toNoStrudelArticle, toNoStrudelNote, toNoStrudelStream } from '@/lib/link'
import { cn } from '@/lib/utils'
import { kinds } from 'nostr-tools'
import NormalNoteCard from '../NoteCard/NormalNoteCard'

export function EmbeddedNote({ noteId, className }: { noteId: string; className?: string }) {
  const { event } = useFetchEvent(noteId)

  return event && [kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(event.kind) ? (
    <NormalNoteCard className={cn('w-full', className)} event={event} embedded />
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
