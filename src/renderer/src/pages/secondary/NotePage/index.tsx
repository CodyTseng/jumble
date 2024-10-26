import { Separator } from '@renderer/components/ui/separator'
import CommentList from '@renderer/components/CommentList'
import Note from '@renderer/components/Note'
import { useFetchEventById } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'

export default function NotePage({ eventId }: { eventId?: string }) {
  const event = eventId ? useFetchEventById(eventId) : null

  return (
    <SecondaryPageLayout>
      {event && (
        <>
          <Note event={event} />
          <Separator className="my-4" />
          <CommentList key={event.id} className="pl-4" event={event} />
        </>
      )}
    </SecondaryPageLayout>
  )
}
