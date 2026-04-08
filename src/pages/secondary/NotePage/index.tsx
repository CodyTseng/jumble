import { useSecondaryPage } from '@/PageManager'
import ContentPreview from '@/components/ContentPreview'
import Note from '@/components/Note'
import NoteInteractions from '@/components/NoteInteractions'
import StuffStats from '@/components/StuffStats'
import UserAvatar, { UserAvatarSkeleton } from '@/components/UserAvatar'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ExtendedKind } from '@/constants'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  getEventKey,
  getKeyFromTag,
  getParentBech32Id,
  getParentTag,
  getRootBech32Id
} from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from './NotFound'

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
        <div className="px-4 pt-3">
          <div className="flex items-center space-x-2">
            <UserAvatarSkeleton className="h-10 w-10" />
            <div className={`w-0 flex-1`}>
              <div className="py-1">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="py-0.5">
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
          <div className="pt-2">
            <div className="my-1">
              <Skeleton className="my-1 mt-2 h-4 w-full" />
            </div>
            <div className="my-1">
              <Skeleton className="my-1 h-4 w-2/3" />
            </div>
          </div>
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!event) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
        <NotFound bech32Id={id} />
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Note')} displayScrollToTopButton>
      <div className="px-4 pt-3">
        {rootITag && <ExternalRoot value={rootITag[1]} />}
        {rootEventId && rootEventId !== parentEventId && (
          <ParentNote
            key={`root-note-${event.id}`}
            isFetching={isFetchingRootEvent}
            event={rootEvent}
            eventBech32Id={rootEventId}
            isConsecutive={isConsecutive(rootEvent, parentEvent)}
          />
        )}
        {parentEventId && (
          <ParentNote
            key={`parent-note-${event.id}`}
            isFetching={isFetchingParentEvent}
            event={parentEvent}
            eventBech32Id={parentEventId}
          />
        )}
        <Note
          key={`note-${event.id}`}
          event={event}
          className="select-text"
          hideParentNotePreview
          originalNoteId={id}
          showFull
        />
        <StuffStats className="mt-3" stuff={event} fetchIfNotExisting displayTopZapsAndLikes />
      </div>
      <Separator className="mt-4" />
      <NoteInteractions key={`note-interactions-${event.id}`} event={event} />
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
        className="clickable flex items-center space-x-1 px-1.5 py-1 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => push(toExternalContent(value))}
      >
        <div className="truncate">{value}</div>
      </Card>
      <div className="ml-5 h-2 w-px bg-border" />
    </div>
  )
}

function ParentNote({
  event,
  eventBech32Id,
  isFetching,
  isConsecutive = true
}: {
  event?: Event
  eventBech32Id: string
  isFetching: boolean
  isConsecutive?: boolean
}) {
  const { push } = useSecondaryPage()

  if (isFetching) {
    return (
      <div>
        <div className="clickable flex items-center space-x-1 rounded-full border px-[0.4375rem] py-1 text-sm text-muted-foreground">
          <UserAvatarSkeleton className="h-4 w-4 shrink" />
          <div className="flex-1 py-1">
            <Skeleton className="h-3" />
          </div>
        </div>
        <div className="ml-5 h-3 w-px bg-border" />
      </div>
    )
  }

  return (
    <div>
      <div
        className={cn(
          'clickable flex items-center space-x-1 rounded-full border px-[0.4375rem] py-1 text-sm text-muted-foreground',
          event && 'hover:text-foreground'
        )}
        onClick={() => {
          push(toNote(event ?? eventBech32Id))
        }}
      >
        {event && <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />}
        <ContentPreview className="truncate" event={event} />
      </div>
      {isConsecutive ? (
        <div className="ml-5 h-3 w-px bg-border" />
      ) : (
        <Ellipsis className="ml-3.5 size-3 text-muted-foreground/60" />
      )}
    </div>
  )
}

function isConsecutive(rootEvent?: Event, parentEvent?: Event) {
  if (!rootEvent || !parentEvent) return false

  const tag = getParentTag(parentEvent)
  if (!tag) return false

  return getEventKey(rootEvent) === getKeyFromTag(tag.tag)
}
