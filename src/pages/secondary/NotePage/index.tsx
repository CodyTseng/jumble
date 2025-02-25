import { useSecondaryPage } from '@/PageManager'
import ContentPreview from '@/components/ContentPreview'
import Nip22ReplyNoteList from '@/components/Nip22ReplyNoteList'
import Note from '@/components/Note'
import PictureNote from '@/components/PictureNote'
import ReplyNoteList from '@/components/ReplyNoteList'
import UserAvatar from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getParentEventId, getRootEventId, isPictureEvent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { kinds } from 'nostr-tools'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'
import { useMuteList } from '@/providers/MuteListProvider'

const NotePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const parentEventId = useMemo(() => getParentEventId(event), [event])
  const rootEventId = useMemo(() => getRootEventId(event), [event])

  if (!event && isFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Note')}>
        <div className="px-4">
          <div className="flex items-center space-x-2">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className={`flex-1 w-0`}>
              <div className="py-1">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="py-0.5">
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
          <div className="pt-2">
            <div className="my-1">
              <Skeleton className="w-full h-4 my-1 mt-2" />
            </div>
            <div className="my-1">
              <Skeleton className="w-2/3 h-4 my-1" />
            </div>
          </div>
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
        <Note key={`note-${event.id}`} event={event} fetchNoteStats hideParentNotePreview />
      </div>
      <Separator className="mb-2 mt-4" />
      {event.kind === kinds.ShortTextNote ? (
        <ReplyNoteList key={`reply-note-list-${event.id}`} event={event} className="px-2" />
      ) : isPictureEvent(event) ? (
        <Nip22ReplyNoteList
          key={`nip22-reply-note-list-${event.id}`}
          event={event}
          className="px-2"
        />
      ) : null}
    </SecondaryPageLayout>
  )
})
NotePage.displayName = 'NotePage'
export default NotePage

function ParentNote({ eventId }: { eventId?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { mutePubkeys } = useMuteList()
  const { event, isFetching } = useFetchEvent(eventId)
  if (!eventId) return null

  if (isFetching) {
    return (
      <div>
        <Card
          className="flex space-x-1 p-1 items-center clickable text-sm text-muted-foreground hover:text-foreground"
          onClick={() => push(toNote(eventId))}
        >
          <Skeleton className="shrink w-4 h-4 rounded-full" />
          <div className="py-1 flex-1">
            <Skeleton className="h-3" />
          </div>
        </Card>
        <div className="ml-5 w-px h-2 bg-border" />
      </div>
    )
  }

  if (!event) {
    return (
      <div>
        <Card className="flex p-1 items-center justify-center text-sm text-muted-foreground">
          {t('Not found')}
        </Card>
        <div className="ml-5 w-px h-2 bg-border" />
      </div>
    )
  }

  if (mutePubkeys.includes(event.pubkey)) {
    return (
      <div>
        <Card
          className="flex space-x-1 p-1 items-center clickable text-sm text-muted-foreground hover:text-foreground"
          onClick={() => push(toNote(eventId))}
        >
          <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />
          <SimpleUsername
            userId={event.pubkey}
            className="font-semibold truncate shrink-0"
            skeletonClassName="h-3 shrink-0"
          />
          <div>[{t('This user has been muted')}]</div>
        </Card>
        <div className="ml-5 w-px h-2 bg-border" />
      </div>
    )
  }

  return (
    <div>
      <Card
        className="flex space-x-1 p-1 items-center clickable text-sm text-muted-foreground hover:text-foreground"
        onClick={() => push(toNote(eventId))}
      >
        <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />
        <SimpleUsername
          userId={event.pubkey}
          className="font-semibold truncate shrink-0"
          skeletonClassName="h-3 shrink-0"
        />
        <ContentPreview className="truncate" event={event} />
      </Card>
      <div className="ml-5 w-px h-2 bg-border" />
    </div>
  )
}
