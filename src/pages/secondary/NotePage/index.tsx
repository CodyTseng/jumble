import { useSecondaryPage } from '@/PageManager'
import Nip22ReplyNoteList from '@/components/Nip22ReplyNoteList'
import Note from '@/components/Note'
import PictureNote from '@/components/PictureNote'
import ReplyNoteList from '@/components/ReplyNoteList'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getParentEventId, getRootEventId, isPictureEvent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'

const NotePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const parentEventId = useMemo(() => getParentEventId(event), [event])
  const rootEventId = useMemo(() => getRootEventId(event), [event])

  if (!event && isFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Note')}>
        <div className="px-4">
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!event) return <NotFoundPage />

  if (isPictureEvent(event)) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
        <PictureNote key={`note-${event.id}`} event={event} fetchNoteStats />
        <Separator className="mb-2 mt-4" />
        <Nip22ReplyNoteList
          key={`nip22-reply-note-list-${event.id}`}
          event={event}
          className="px-2"
        />
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
      <div className="px-4">
        {rootEventId !== parentEventId && (
          <ParentNote key={`root-note-${event.id}`} eventId={rootEventId} />
        )}
        <ParentNote key={`parent-note-${event.id}`} eventId={parentEventId} />
        <Note key={`note-${event.id}`} event={event} fetchNoteStats />
      </div>
      <Separator className="mb-2 mt-4" />
      {isPictureEvent(event) ? (
        <Nip22ReplyNoteList
          key={`nip22-reply-note-list-${event.id}`}
          event={event}
          className="px-2"
        />
      ) : (
        <ReplyNoteList key={`reply-note-list-${event.id}`} event={event} className="px-2" />
      )}
    </SecondaryPageLayout>
  )
})
NotePage.displayName = 'NotePage'
export default NotePage

function ParentNote({ eventId }: { eventId?: string }) {
  const { push } = useSecondaryPage()
  const { event } = useFetchEvent(eventId)
  if (!event) return null

  return (
    <div>
      <Card
        className="flex space-x-1 p-1 items-center clickable text-sm text-muted-foreground hover:text-foreground"
        onClick={() => push(toNote(event))}
      >
        <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />
        <Username
          userId={event.pubkey}
          className="font-semibold"
          skeletonClassName="h-4 shrink-0"
        />
        <div className="truncate">{event.content}</div>
      </Card>
      <div className="ml-5 w-px h-2 bg-border" />
    </div>
  )
}
