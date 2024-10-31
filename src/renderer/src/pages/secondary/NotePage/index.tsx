import ReplyNoteList from '@renderer/components/ReplyNoteList'
import Note from '@renderer/components/Note'
import { Separator } from '@renderer/components/ui/separator'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { Event } from 'nostr-tools'

export default function NotePage({ event }: { event?: Event }) {
  return (
    <SecondaryPageLayout titlebarContent="note">
      {event && (
        <>
          <Note key={`note-${event.id}`} event={event} displayStats />
          <Separator className="mt-2" />
          <ReplyNoteList key={`reply-note-list-${event.id}`} event={event} />
        </>
      )}
    </SecondaryPageLayout>
  )
}
