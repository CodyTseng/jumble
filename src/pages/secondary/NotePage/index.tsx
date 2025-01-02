import { useSecondaryPage } from '@/PageManager'
import Note from '@/components/Note'
import ReplyNoteList from '@/components/ReplyNoteList'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getParentEventId, getRootEventId } from '@/lib/event'
import { toNote } from '@/lib/link'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'

export default function NotePage({ id, index }: { id?: string; index?: number }) {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const parentEventId = useMemo(() => getParentEventId(event), [event])
  const rootEventId = useMemo(() => getRootEventId(event), [event])

  if (!event && isFetching) {
    return (
      <SecondaryPageLayout index={index} titlebarContent={t('Note')} displayScrollToTopButton>
        <div className="px-4">
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!event) return <NotFoundPage />

  return (
    <SecondaryPageLayout index={index} titlebarContent={t('Note')}>
      <div className="px-4">
        <ParentNote key={`root-note-${event.id}`} eventId={rootEventId} />
        <ParentNote key={`parent-note-${event.id}`} eventId={parentEventId} />
        <Note key={`note-${event.id}`} event={event} fetchNoteStats />
      </div>
      <Separator className="mb-2 mt-4" />
      <ReplyNoteList key={`reply-note-list-${event.id}`} event={event} className="px-2" />
    </SecondaryPageLayout>
  )
}

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
        <UserAvatar userId={event.pubkey} size="tiny" />
        <Username userId={event.pubkey} className="font-semibold" skeletonClassName="h-4" />
        <div className="truncate">{event.content}</div>
      </Card>
      <div className="ml-5 w-px h-2 bg-border" />
    </div>
  )
}
