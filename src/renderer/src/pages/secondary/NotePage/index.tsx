import { useSecondaryPage } from '@renderer/PageManager'
import Note from '@renderer/components/Note'
import ReplyNoteList from '@renderer/components/ReplyNoteList'
import UserAvatar from '@renderer/components/UserAvatar'
import Username from '@renderer/components/Username'
import { Card } from '@renderer/components/ui/card'
import { Separator } from '@renderer/components/ui/separator'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useFetchEvent } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { getParentEventId, getRootEventId } from '@renderer/lib/event'
import { toNote } from '@renderer/lib/link'
import { useMemo } from 'react'
import NotFoundPage from '../NotFoundPage'
import { useTranslation } from 'react-i18next'

export default function NotePage({ id }: { id?: string }) {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const parentEventId = useMemo(() => getParentEventId(event), [event])
  const rootEventId = useMemo(() => getRootEventId(event), [event])

  if (!event && isFetching) {
    return (
      <SecondaryPageLayout titlebarContent={t('note')}>
        <div className="max-sm:px-4">
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!event) return <NotFoundPage />

  return (
    <SecondaryPageLayout titlebarContent={t('note')}>
      <div className="max-sm:px-4">
        <ParentNote key={`root-note-${event.id}`} eventId={rootEventId} />
        <ParentNote key={`parent-note-${event.id}`} eventId={parentEventId} />
        <Note key={`note-${event.id}`} event={event} fetchNoteStats />
      </div>
      <Separator className="my-4" />
      <ReplyNoteList key={`reply-note-list-${event.id}`} event={event} className="max-sm:px-2" />
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
        className="flex space-x-1 p-1 items-center hover:bg-muted/50 cursor-pointer text-sm text-muted-foreground hover:text-foreground"
        onClick={() => push(toNote(event.id))}
      >
        <UserAvatar userId={event.pubkey} size="tiny" />
        <Username userId={event.pubkey} className="font-semibold" skeletonClassName="h-4" />
        <div className="truncate">{event.content}</div>
      </Card>
      <div className="ml-5 w-px h-2 bg-border" />
    </div>
  )
}
