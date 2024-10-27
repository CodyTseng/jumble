import ReplyNoteList from '@renderer/components/ReplyNoteList'
import Note from '@renderer/components/Note'
import { Separator } from '@renderer/components/ui/separator'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { Event } from 'nostr-tools'

export default function NotePage({ event }: { event?: Event }) {
  return (
    <SecondaryPageLayout>
      {event && (
        <>
          <Note event={event} />
          <Separator className="mt-4" />
          <ReplyNoteList key={event.id} event={event} />
        </>
      )}
    </SecondaryPageLayout>
  )
}
