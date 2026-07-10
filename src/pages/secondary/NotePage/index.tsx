import { useSecondaryPage } from '@/PageManager'
import ClickableCard from '@/components/ClickableCard'
import ClientTag from '@/components/ClientTag'
import ContentPreview from '@/components/ContentPreview'
import FollowingBadge from '@/components/FollowingBadge'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import Nip05 from '@/components/Nip05'
import Note from '@/components/Note'
import RepostDescription from '@/components/NoteCard/RepostDescription'
import NoteContent from '@/components/NoteContent'
import NoteInteractions from '@/components/NoteInteractions'
import NoteOptions from '@/components/NoteOptions'
import OpBadge from '@/components/OpBadge'
import ProtectedBadge from '@/components/ProtectedBadge'
import StuffStats from '@/components/StuffStats'
import TranslateButton from '@/components/TranslateButton'
import TrustScoreBadge from '@/components/TrustScoreBadge'
import UserAvatar, { UserAvatarSkeleton } from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ExtendedKind } from '@/constants'
import { isRepostEvent, useFetchEvent, useRepostTarget } from '@/hooks'
import { useAncestorChain } from '@/hooks/useThread'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  getEventKey,
  getKeyFromTag,
  getParentBech32Id,
  getParentTag,
  getRootBech32Id,
  getRootTag
} from '@/lib/event'
import { getEventAuthorPubkey } from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import threadService from '@/services/thread.service'
import { TPageRef } from '@/types'
import { Ellipsis, FoldVertical, UnfoldVertical } from 'lucide-react'
import { Event } from 'nostr-tools'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from './NotFound'

const NotePage = forwardRef<TPageRef, { id?: string; index?: number }>(({ id, index }, ref) => {
  const { t } = useTranslation()
  const { autoLoadProfilePicture } = useContentPolicy()
  const { event: fetchedEvent, isFetching } = useFetchEvent(id)
  const isRepost = isRepostEvent(fetchedEvent)
  const { targetEvent: repostTarget, isResolving: isResolvingRepostTarget } = useRepostTarget(
    isRepost ? fetchedEvent : undefined
  )
  const event = isRepost ? (repostTarget ?? undefined) : fetchedEvent
  const reposters = useMemo(
    () => (isRepost && fetchedEvent ? [fetchedEvent.pubkey] : undefined),
    [isRepost, fetchedEvent]
  )
  const parentEventId = useMemo(() => getParentBech32Id(event), [event])
  const rootEventId = useMemo(() => getRootBech32Id(event), [event])
  const rootTagKey = useMemo(() => {
    const tag = getRootTag(event)
    return tag ? getKeyFromTag(tag.tag) : undefined
  }, [event])
  const parentTagKey = useMemo(() => {
    const tag = getParentTag(event)
    return tag ? getKeyFromTag(tag.tag) : undefined
  }, [event])
  const hasDistinctRootAndParent = !!rootTagKey && rootTagKey !== parentTagKey
  const rootITag = useMemo(
    () => (event?.kind === ExtendedKind.COMMENT ? event.tags.find(tagNameEquals('I')) : undefined),
    [event]
  )
  const { isFetching: isFetchingRootEvent, event: rootEvent } = useFetchEvent(rootEventId)
  const { isFetching: isFetchingParentEvent, event: parentEvent } = useFetchEvent(parentEventId)
  const [expanded, setExpanded] = useState(false)
  const currentKey = useMemo(() => (event ? getEventKey(event) : ''), [event])
  const rootKey = useMemo(() => (rootEvent ? getEventKey(rootEvent) : ''), [rootEvent])
  const opPubkey = useMemo(
    () =>
      (rootEvent ? getEventAuthorPubkey(rootEvent) : undefined) ??
      (!rootEventId && !rootITag && event ? getEventAuthorPubkey(event) : undefined),
    [rootEvent, rootEventId, rootITag, event]
  )
  const ancestorChain = useAncestorChain(currentKey, rootKey)
  const canExpand = !!parentEventId
  const fullChain = useMemo(() => {
    const chain = Array.from(new Set(ancestorChain))
    if (rootEvent && !chain.includes(rootEvent.id)) {
      chain.unshift(rootEvent.id)
    }
    if (parentEvent && !chain.includes(parentEvent.id)) {
      chain.push(parentEvent.id)
    }
    return chain
  }, [rootEvent, parentEvent, ancestorChain])
  const layoutRef = useRef<TPageRef>(null)

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: (behavior) => layoutRef.current?.scrollToTop(behavior)
    }),
    []
  )

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const prevExpandedRef = useRef(expanded)
  useLayoutEffect(() => {
    if (prevExpandedRef.current && !expanded) {
      layoutRef.current?.scrollToTop('instant')
    }
    prevExpandedRef.current = expanded
  }, [expanded])

  useEffect(() => {
    if (!expanded || !event) return
    threadService.subscribe(event)
    return () => {
      threadService.unsubscribe(event)
    }
  }, [expanded, event])

  useEffect(() => {
    if (!canExpand) setExpanded(false)
  }, [canExpand])

  if (!event && (isFetching || isResolvingRepostTarget)) {
    return (
      <SecondaryPageLayout ref={layoutRef} index={index} title={t('Note')}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2">
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
      <SecondaryPageLayout ref={layoutRef} index={index} title={t('Note')} displayScrollToTopButton>
        <NotFound bech32Id={id} />
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={layoutRef} index={index} title={t('Note')} displayScrollToTopButton>
      <div>
        {rootITag && (
          <div className="px-4 pt-3">
            <ExternalRoot value={rootITag[1]} />
          </div>
        )}
        {expanded
          ? fullChain.map((id, idx) => (
              <ChainItem
                key={`chain-${id}`}
                eventId={id}
                isFirst={idx === 0 && !rootITag}
                opPubkey={opPubkey}
              />
            ))
          : canExpand && (
              <div className={cn('px-4', !rootITag && 'pt-3')}>
                {rootEventId && hasDistinctRootAndParent && (
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
                    noConnector
                  />
                )}
                {autoLoadProfilePicture && <div className="bg-border ms-4.75 h-1.5 w-0.5" />}
              </div>
            )}
        {canExpand && <ExpandThreadButton expanded={expanded} onToggle={handleToggleExpand} />}
        <div className={cn('relative px-4 pt-3', canExpand && 'pt-1')}>
          {reposters && <RepostDescription reposters={reposters} />}
          <Note
            key={`note-${event.id}`}
            event={event}
            className="select-text"
            hideParentNotePreview
            originalNoteId={isRepost ? undefined : id}
            showFull
            opPubkey={opPubkey}
          />
          <StuffStats
            className="mt-3"
            classNames={{ topList: '-mx-4', topListContent: 'px-4' }}
            stuff={event}
            fetchIfNotExisting
            displayTopZapsAndLikes
          />
        </div>
      </div>
      <Separator className="mt-4" />
      <NoteInteractions key={`note-interactions-${event.id}`} event={event} opPubkey={opPubkey} />
    </SecondaryPageLayout>
  )
})
NotePage.displayName = 'NotePage'
export default NotePage

function ExternalRoot({ value }: { value: string }) {
  const { push } = useSecondaryPage()
  const { autoLoadProfilePicture } = useContentPolicy()

  return (
    <div>
      <Card
        className="clickable text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-1 text-sm"
        onClick={() => push(toExternalContent(value))}
      >
        <div className="truncate">{value}</div>
      </Card>
      {autoLoadProfilePicture ? (
        <div className="bg-border ms-5 h-2 w-px" />
      ) : (
        <div className="h-2" />
      )}
    </div>
  )
}

function ParentNote({
  event,
  eventBech32Id,
  isFetching,
  isConsecutive = true,
  noConnector = false
}: {
  event?: Event
  eventBech32Id: string
  isFetching: boolean
  isConsecutive?: boolean
  noConnector?: boolean
}) {
  const { push } = useSecondaryPage()
  const { autoLoadProfilePicture } = useContentPolicy()
  const displayPubkey = event ? getEventAuthorPubkey(event) : undefined
  const showLine = !noConnector && autoLoadProfilePicture
  const showSpacer = !noConnector && !autoLoadProfilePicture

  if (isFetching) {
    return (
      <div>
        <div className="clickable text-muted-foreground flex items-center gap-1 rounded-full border px-1.75 py-1 text-sm">
          <UserAvatarSkeleton className="h-4 w-4 shrink" />
          <div className="flex-1 py-1">
            <Skeleton className="h-3" />
          </div>
        </div>
        {showLine ? (
          <div className="bg-border ms-4.75 h-3 w-0.5" />
        ) : showSpacer ? (
          <div className="h-1.5" />
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <div
        className={cn(
          'clickable text-muted-foreground flex items-center gap-1 rounded-full border px-1.75 py-1 text-sm',
          event && 'hover:text-foreground'
        )}
        onClick={() => {
          push(toNote(event ?? eventBech32Id))
        }}
      >
        {displayPubkey && <UserAvatar userId={displayPubkey} size="tiny" className="shrink-0" />}
        <ContentPreview className="truncate" event={event} />
      </div>
      {!isConsecutive ? (
        <Ellipsis className="text-muted-foreground/60 ms-3.5 size-3" />
      ) : showLine ? (
        <div className="bg-border ms-4.75 h-3 w-0.5" />
      ) : showSpacer ? (
        <div className="h-1.5" />
      ) : null}
    </div>
  )
}

function isConsecutive(rootEvent?: Event, parentEvent?: Event) {
  if (!rootEvent || !parentEvent) return false

  const tag = getParentTag(parentEvent)
  if (!tag) return false

  return getEventKey(rootEvent) === getKeyFromTag(tag.tag)
}

function ChainItem({
  eventId,
  isFirst,
  opPubkey
}: {
  eventId: string
  isFirst: boolean
  opPubkey?: string
}) {
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const { autoLoadProfilePicture } = useContentPolicy()
  const { event, isFetching } = useFetchEvent(eventId)
  const displayPubkey = event ? getEventAuthorPubkey(event) : undefined

  if (isFetching) {
    return <ChainItemSkeleton isFirst={isFirst} />
  }
  if (!event) {
    return null
  }

  return (
    <ClickableCard
      className={cn(
        'clickable hover:bg-accent/30 relative px-4 py-3 transition-colors duration-200',
        !autoLoadProfilePicture && 'border-b'
      )}
      onClick={() => push(toNote(event))}
    >
      {autoLoadProfilePicture && !isFirst && (
        <div className="bg-border absolute inset-s-8.75 top-0 z-0 h-2 w-0.5" />
      )}
      {autoLoadProfilePicture && (
        <div className="bg-border absolute inset-s-8.75 top-14.5 bottom-0 z-0 w-0.5" />
      )}
      <div className="flex items-start gap-2">
        <UserAvatar userId={displayPubkey ?? event.pubkey} size="normal" className="shrink-0" />
        <div className="w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="w-0 flex-1">
              <div className="flex items-center gap-2">
                <Username
                  userId={displayPubkey ?? event.pubkey}
                  className="flex truncate font-semibold"
                  skeletonClassName="h-4"
                />
                <FollowingBadge pubkey={displayPubkey ?? event.pubkey} />
                {opPubkey === (displayPubkey ?? event.pubkey) && <OpBadge />}
                <TrustScoreBadge pubkey={displayPubkey ?? event.pubkey} />
                <ProtectedBadge event={event} />
                <ClientTag event={event} />
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Nip05 pubkey={displayPubkey ?? event.pubkey} append="·" />
                <FormattedTimestamp
                  timestamp={event.created_at}
                  className="shrink-0"
                  short={isSmallScreen}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <TranslateButton event={event} className="py-0" />
              <NoteOptions event={event} className="shrink-0 [&_svg]:size-5" />
            </div>
          </div>
          <NoteContent className="mt-2" event={event} />
          <StuffStats className="mt-2" stuff={event} />
        </div>
      </div>
    </ClickableCard>
  )
}

function ChainItemSkeleton({ isFirst }: { isFirst: boolean }) {
  const { autoLoadProfilePicture } = useContentPolicy()

  return (
    <div className={cn('relative px-4 py-3', !autoLoadProfilePicture && 'border-b')}>
      {autoLoadProfilePicture && !isFirst && (
        <div className="bg-border absolute inset-s-8.75 top-0 z-0 h-2 w-0.5" />
      )}
      {autoLoadProfilePicture && (
        <div className="bg-border absolute inset-s-8.75 top-14.5 bottom-0 z-0 w-0.5" />
      )}
      <div className="flex items-start gap-2">
        <UserAvatarSkeleton className="h-10 w-10" />
        <div className="w-0 flex-1">
          <div className="py-1">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="py-0.5">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandThreadButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const { autoLoadProfilePicture } = useContentPolicy()

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'clickable text-muted-foreground hover:text-foreground hover:bg-accent/30 relative flex w-full items-center gap-2 py-1.5 pe-4 text-sm transition-colors',
        autoLoadProfilePicture ? 'ps-16' : 'border-b ps-4'
      )}
    >
      {autoLoadProfilePicture && (
        <div className="bg-border absolute inset-s-8.75 top-0 bottom-0 z-0 w-0.5" />
      )}
      {expanded ? <FoldVertical className="size-4" /> : <UnfoldVertical className="size-4" />}
      {expanded ? t('Hide thread context') : t('Show thread context')}
    </button>
  )
}
