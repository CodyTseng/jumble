import CommentList from '@renderer/components/CommentList'
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
          <Separator className="my-4" />
          <CommentList key={event.id} event={event} />
        </>
      )}
    </SecondaryPageLayout>
  )
}
