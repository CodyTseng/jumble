import { useSecondaryPage } from '@/PageManager'
import ClientTag from '@/components/ClientTag'
import Content from '@/components/Content'
import ContentPreview from '@/components/ContentPreview'
import FollowingBadge from '@/components/FollowingBadge'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import Nip05 from '@/components/Nip05'
import Note from '@/components/Note'
import NoteInteractions from '@/components/NoteInteractions'
import NoteOptions from '@/components/NoteOptions'
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
import { useFetchEvent } from '@/hooks'
import { useAncestorChain } from '@/hooks/useThread'
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
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from './NotFound'

const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"]'

const NotePage = forwardRef<TPageRef, { id?: string; index?: number }>(({ id, index }, ref) => {
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
  const [expanded, setExpanded] = useState(false)
  const currentKey = useMemo(() => (event ? getEventKey(event) : ''), [event])
  const rootKey = useMemo(() => (rootEvent ? getEventKey(rootEvent) : ''), [rootEvent])
  const ancestorChain = useAncestorChain(currentKey, rootKey)
  const canExpand = !!parentEventId
  const fullChain = useMemo(() => {
    const items: Event[] = []
    const seen = new Set<string>()
    if (rootEvent && rootEventId && rootEventId !== parentEventId) {
      items.push(rootEvent)
      seen.add(rootEvent.id)
    }
    for (const evt of ancestorChain) {
      if (seen.has(evt.id)) continue
      items.push(evt)
      seen.add(evt.id)
    }
    if (parentEvent && !seen.has(parentEvent.id)) {
      items.push(parentEvent)
    }
    return items
  }, [rootEvent, rootEventId, parentEvent, parentEventId, ancestorChain])
  const layoutRef = useRef<TPageRef>(null)

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: (behavior) => layoutRef.current?.scrollToTop(behavior)
    }),
    []
  )

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      if (!next) layoutRef.current?.scrollToTop('instant')
      return next
    })
  }, [])

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

  if (!event && isFetching) {
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
          ? fullChain.map((ancestor, idx) => (
              <ChainItem
                key={`chain-${ancestor.id}`}
                event={ancestor}
                isFirst={idx === 0 && !rootITag}
              />
            ))
          : canExpand && (
              <div className={cn('px-4', !rootITag && 'pt-3')}>
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
                    noConnector
                  />
                )}
                <div className="bg-border ms-5 h-1 w-px" />
              </div>
            )}
        {canExpand && <ExpandThreadButton expanded={expanded} onToggle={handleToggleExpand} />}
        <div className={cn('relative px-4 pt-3', canExpand && 'pt-1')}>
          <Note
            key={`note-${event.id}`}
            event={event}
            className="select-text"
            hideParentNotePreview
            originalNoteId={id}
            showFull
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
        className="clickable text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-1 text-sm"
        onClick={() => push(toExternalContent(value))}
      >
        <div className="truncate">{value}</div>
      </Card>
      <div className="bg-border ms-5 h-2 w-px" />
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

  if (isFetching) {
    return (
      <div>
        <div className="clickable text-muted-foreground flex items-center gap-1 rounded-full border px-1.75 py-1 text-sm">
          <UserAvatarSkeleton className="h-4 w-4 shrink" />
          <div className="flex-1 py-1">
            <Skeleton className="h-3" />
          </div>
        </div>
        {!noConnector && <div className="bg-border ms-5 h-3 w-px" />}
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
        {event && <UserAvatar userId={event.pubkey} size="tiny" className="shrink-0" />}
        <ContentPreview className="truncate" event={event} />
      </div>
      {!noConnector &&
        (isConsecutive ? (
          <div className="bg-border ms-5 h-3 w-px" />
        ) : (
          <Ellipsis className="text-muted-foreground/60 ms-3.5 size-3" />
        ))}
    </div>
  )
}

function isConsecutive(rootEvent?: Event, parentEvent?: Event) {
  if (!rootEvent || !parentEvent) return false

  const tag = getParentTag(parentEvent)
  if (!tag) return false

  return getEventKey(rootEvent) === getKeyFromTag(tag.tag)
}

function ChainItem({ event, isFirst }: { event: Event; isFirst: boolean }) {
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()

  return (
    <div
      className="clickable hover:bg-accent/30 relative px-4 py-3 transition-colors duration-200"
      onClick={(e) => {
        const target = e.target
        if (!(target instanceof Node) || !e.currentTarget.contains(target)) return
        if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return
        push(toNote(event))
      }}
    >
      <div
        className={cn(
          'bg-border absolute inset-s-9 bottom-0 z-0 w-px',
          isFirst ? 'top-15' : 'top-0'
        )}
      />
      <div className="flex items-start gap-2">
        <UserAvatar userId={event.pubkey} size="normal" className="shrink-0" />
        <div className="w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="w-0 flex-1">
              <div className="flex items-center gap-2">
                <Username
                  userId={event.pubkey}
                  className="flex truncate font-semibold"
                  skeletonClassName="h-4"
                />
                <FollowingBadge pubkey={event.pubkey} />
                <TrustScoreBadge pubkey={event.pubkey} />
                <ProtectedBadge event={event} />
                <ClientTag event={event} />
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Nip05 pubkey={event.pubkey} append="·" />
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
          <Content className="mt-2" event={event} />
          <StuffStats className="mt-2" stuff={event} />
        </div>
      </div>
    </div>
  )
}

function ExpandThreadButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onToggle}
      className="clickable text-muted-foreground hover:text-foreground hover:bg-accent/30 relative flex w-full items-center gap-2 py-1.5 ps-11 pe-4 text-sm transition-colors"
    >
      <div className="bg-border absolute inset-s-9 top-0 bottom-0 z-0 w-px" />
      {expanded ? <FoldVertical className="size-4" /> : <UnfoldVertical className="size-4" />}
      {expanded ? t('Hide thread context') : t('Show thread context')}
    </button>
  )
}
