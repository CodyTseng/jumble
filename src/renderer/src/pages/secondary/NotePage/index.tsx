import { useSecondaryPage } from '@renderer/PageManager'
import Note from '@renderer/components/Note'
import ReplyNoteList from '@renderer/components/ReplyNoteList'
import UserAvatar from '@renderer/components/UserAvatar'
import Username from '@renderer/components/Username'
import { Card } from '@renderer/components/ui/card'
import { Separator } from '@renderer/components/ui/separator'
import { useFetchEventById } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { getParentEventId, getRootEventId } from '@renderer/lib/event'
import { toNote } from '@renderer/lib/link'
import { useMemo } from 'react'
import LoadingPage from '../LoadingPage'
import NotFoundPage from '../NotFoundPage'

export default function NotePage({ id }: { id?: string }) {
  const { event, isFetching } = useFetchEventById(id)
  const parentEventId = useMemo(() => getParentEventId(event), [event])
  const rootEventId = useMemo(() => getRootEventId(event), [event])

  if (!event && isFetching) return <LoadingPage title="note" />
  if (!event) return <NotFoundPage />

  return (
    <SecondaryPageLayout titlebarContent="note">
      <ParentNote key={`root-note-${event.id}`} eventId={rootEventId} />
      <ParentNote key={`parent-note-${event.id}`} eventId={parentEventId} />
      <Note key={`note-${event.id}`} event={event} fetchNoteStats />
      <Separator className="my-4" />
      <ReplyNoteList key={`reply-note-list-${event.id}`} event={event} />
    </SecondaryPageLayout>
  )
}

function ParentNote({ eventId }: { eventId?: string }) {
  const { push } = useSecondaryPage()
  const { event } = useFetchEventById(eventId)
  if (!event) return null

  return (
    <div>
      <Card
        className="flex space-x-1 p-1 items-center hover:bg-muted/50 cursor-pointer text-sm text-muted-foreground hover:text-foreground"
        onClick={() => push(toNote(event.id))}
      >
        <UserAvatar userId={event.pubkey} size="tiny" />
        <Username userId={event.pubkey} className="font-semibold" />
        <div className="truncate">{event.content}</div>
      </Card>
      <div className="ml-5 w-px h-2 bg-border" />
    </div>
  )
}
