import { useSecondaryPage } from '@/PageManager'
import ContentPreview from '@/components/ContentPreview'
import Note from '@/components/Note'
import NoteInteractions from '@/components/NoteInteractions'
import NoteStats from '@/components/NoteStats'
import PictureNote from '@/components/PictureNote'
import UserAvatar from '@/components/UserAvatar'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ExtendedKind } from '@/constants'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getParentBech32Id, getParentETag, getRootBech32Id, isPictureEvent } from '@/lib/event'
import { toNote, toNoteList } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'

const NotePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const parentEventId = useMemo(() => getParentBech32Id(event), [event])
  const rootEventId = useMemo(() => getRootBech32Id(event), [event])
  const rootITag = useMemo(
    () => (event?.kind === ExtendedKind.COMMENT ? event.tags.find(tagNameEquals('I')) : undefined),
    [event]
  )
  const { isFetching: isFetchingRootEvent, event: rootEvent } = useFetchEvent(rootEventId)
  const { isFetching: isFetchingParentEvent, event: parentEvent } = useFetchEvent(parentEventId)

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
        <Separator className="mt-4" />
        <NoteInteractions key={`note-interactions-${event.id}`} pageIndex={index} event={event} />
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
      <div className="px-4">
        {rootITag && <ExternalRoot value={rootITag[1]} />}
        {rootEventId !== parentEventId && (
          <ParentNote
            key={`root-note-${event.id}`}
            isFetching={isFetchingRootEvent}
            event={rootEvent}
            isConsecutive={isConsecutive(rootEvent, parentEvent)}
          />
        )}
        <ParentNote
          key={`parent-note-${event.id}`}
          isFetching={isFetchingParentEvent}
          event={parentEvent}
        />
        <Note
          key={`note-${event.id}`}
          event={event}
          className="select-text"
          hideParentNotePreview
          originalNoteId={id}
        />
        <NoteStats className="mt-3" event={event} fetchIfNotExisting displayTopZapsAndLikes />
      </div>
      <Separator className="mt-4" />
      <NoteInteractions key={`note-interactions-${event.id}`} pageIndex={index} event={event} />
    </SecondaryPageLayout>
  )
})
NotePage.displayName = 'NotePage'
export default NotePage

function ExternalRoot({ value }: { value: string }) {
  const { push } = useSecondaryPage()

  return (
    <div>
      <Card
        className="flex space-x-1 px-1.5 py-1 items-center clickable text-sm text-muted-foreground hover:text-foreground"
        onClick={() => push(toNoteList({ externalContentId: value }))}
      >
        <div className="truncate">{value}</div>
      </Card>
      <div className="ml-5 w-px h-2 bg-border" />
    </div>
  )
}

function ParentNote({
  event,
  isFetching,
  isConsecutive = true
}: {
  event?: Event
  isFetching: boolean
  isConsecutive?: boolean
}) {
  const { push } = useSecondaryPage()

  if (isFetching) {
    return (
      <div>
        <Card className="flex space-x-1 px-1.5 py-1 items-center clickable text-sm text-muted-foreground">
          <Skeleton className="shrink w-4 h-4 rounded-full" />
          <div className="py-1 flex-1">
            <Skeleton className="h-3" />
          </div>
        </Card>
        <div className="ml-5 w-px h-3 bg-border" />
      </div>
    )
  }
  if (!event) return null

  return (
    <div>
      <Card
        className={cn(
          'flex space-x-1 px-1.5 py-1 items-center clickable text-sm text-muted-foreground',
          event && 'hover:text-foreground'
        )}
        onClick={() => {
          if (!event) return
          push(toNote(event))
        }}
      >
        {event && <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />}
        <ContentPreview className="truncate" event={event} />
      </Card>
      {isConsecutive ? (
        <div className="ml-5 w-px h-3 bg-border" />
      ) : (
        <Ellipsis className="ml-3.5 text-muted-foreground/60 size-3" />
      )}
    </div>
  )
}

function isConsecutive(rootEvent?: Event, parentEvent?: Event) {
  const eTag = getParentETag(parentEvent)
  if (!eTag) return false

  return rootEvent?.id === eTag[1]
}
