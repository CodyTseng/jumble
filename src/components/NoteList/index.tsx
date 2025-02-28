import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PICTURE_EVENT_KIND } from '@/constants'
import { isReplyNoteEvent } from '@/lib/event'
import { checkAlgoRelay } from '@/lib/relay'
import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import relayInfoService from '@/services/relay-info.service'
import { TNoteListMode } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import NoteCard from '../NoteCard'
import PictureNoteCard from '../PictureNoteCard'

const LIMIT = 100
const ALGO_LIMIT = 500
const SHOW_COUNT = 20

export default function NoteList({
  relayUrls,
  filter = {},
  className,
  filterMutedNotes = true,
  needCheckAlgoRelay = false
}: {
  relayUrls: string[]
  filter?: Filter
  className?: string
  filterMutedNotes?: boolean
  needCheckAlgoRelay?: boolean
}) {
  const { t } = useTranslation()
  const { isLargeScreen } = useScreenSize()
  const { startLogin } = useNostr()
  const { mutePubkeys } = useMuteList()
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [events, setEvents] = useState<Event[]>([])
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState(true)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const isPictures = useMemo(() => listMode === 'pictures', [listMode])
  const noteFilter = useMemo(() => {
    return {
      kinds: isPictures ? [PICTURE_EVENT_KIND] : [kinds.ShortTextNote, kinds.Repost],
      ...filter
    }
  }, [JSON.stringify(filter), isPictures])
  const topRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (relayUrls.length === 0) return

    async function init() {
      setRefreshing(true)
      setEvents([])
      setNewEvents([])
      setHasMore(true)

      let areAlgoRelays = false
      if (needCheckAlgoRelay) {
        const relayInfos = await relayInfoService.getRelayInfos(relayUrls)
        areAlgoRelays = relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo))
      }

      let eventCount = 0
      const { closer, timelineKey } = await client.subscribeTimeline(
        [...relayUrls],
        { ...noteFilter, limit: areAlgoRelays ? ALGO_LIMIT : LIMIT },
        {
          onEvents: (events, eosed) => {
            if (eventCount > events.length) return
            eventCount = events.length

            if (events.length > 0) {
              setEvents(events)
            }
            if (areAlgoRelays) {
              setHasMore(false)
            }
            if (eosed) {
              setRefreshing(false)
              setHasMore(events.length > 0)
            }
          },
          onNew: (event) => {
            setNewEvents((oldEvents) =>
              [event, ...oldEvents].sort((a, b) => b.created_at - a.created_at)
            )
          }
        },
        {
          startLogin,
          needSort: !areAlgoRelays
        }
      )
      setTimelineKey(timelineKey)
      return closer
    }

    const promise = init()
    return () => {
      promise.then((closer) => closer())
    }
  }, [JSON.stringify(relayUrls), noteFilter, refreshCount])

  const loadMore = useCallback(async () => {
    if (showCount < events.length) {
      setShowCount((prev) => prev + SHOW_COUNT)
      return
    }

    if (!timelineKey || refreshing || !hasMore) return
    const newEvents = await client.loadMoreTimeline(
      timelineKey,
      events.length ? events[events.length - 1].created_at - 1 : dayjs().unix(),
      LIMIT
    )
    if (newEvents.length === 0) {
      setHasMore(false)
      return
    }
    setEvents((oldEvents) => [...oldEvents, ...newEvents])
  }, [timelineKey, refreshing, hasMore, events, noteFilter, showCount])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    }, options)

    const currentBottomRef = bottomRef.current

    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [loadMore])

  const showNewEvents = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setEvents((oldEvents) => [...newEvents, ...oldEvents])
    setNewEvents([])
  }

  return (
    <div className={className}>
      <ListModeSwitch
        listMode={listMode}
        setListMode={(listMode) => {
          setListMode(listMode)
          setShowCount(SHOW_COUNT)
          topRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
          storage.setNoteListMode(listMode)
        }}
      />
      <div ref={topRef} />
      {events.length > 0 &&
        newEvents.filter((event: Event) => {
          return (
            (!filterMutedNotes || !mutePubkeys.includes(event.pubkey)) &&
            (listMode !== 'posts' || !isReplyNoteEvent(event))
          )
        }).length > 0 && <ShowNewButton onClick={showNewEvents} />}
      <PullToRefresh
        onRefresh={async () => {
          setRefreshCount((count) => count + 1)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }}
        pullingContent=""
      >
        <div>
          {isPictures ? (
            <PictureNoteCardMasonry
              className="px-2 sm:px-4 mt-2"
              columnCount={isLargeScreen ? 3 : 2}
              events={events.slice(0, showCount)}
            />
          ) : (
            <div>
              {events
                .slice(0, showCount)
                .filter((event: Event) => listMode !== 'posts' || !isReplyNoteEvent(event))
                .map((event) => (
                  <NoteCard
                    key={event.id}
                    className="w-full"
                    event={event}
                    filterMutedNotes={filterMutedNotes}
                  />
                ))}
            </div>
          )}
          {hasMore || refreshing ? (
            <div ref={bottomRef}>
              <LoadingSkeleton isPictures={isPictures} />
            </div>
          ) : events.length ? (
            <div className="text-center text-sm text-muted-foreground mt-2">
              {t('no more notes')}
            </div>
          ) : (
            <div className="flex justify-center w-full mt-2">
              <Button size="lg" onClick={() => setRefreshCount((pre) => pre + 1)}>
                {t('reload notes')}
              </Button>
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

function ShowNewButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()

  return (
    <div
      className={cn(
        'sticky top-[6.25rem] flex justify-center w-full my-2 z-30 duration-700 transition-transform',
        deepBrowsing && lastScrollTop > 800 ? '-translate-y-10' : ''
      )}
    >
      <Button size="lg" onClick={onClick} className="drop-shadow-xl shadow-primary/50">
        {t('show new notes')}
      </Button>
    </div>
  )
}

function ListModeSwitch({
  listMode,
  setListMode
}: {
  listMode: TNoteListMode
  setListMode: (listMode: TNoteListMode) => void
}) {
  const { t } = useTranslation()
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()

  return (
    <div
      className={cn(
        'sticky top-12 bg-background z-30 duration-700 transition-transform',
        deepBrowsing && lastScrollTop > 800 ? '-translate-y-[calc(100%+12rem)]' : ''
      )}
    >
      <div className="flex">
        <div
          className={`w-1/3 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${listMode === 'posts' ? '' : 'text-muted-foreground'}`}
          onClick={() => setListMode('posts')}
        >
          {t('Notes')}
        </div>
        <div
          className={`w-1/3 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${listMode === 'postsAndReplies' ? '' : 'text-muted-foreground'}`}
          onClick={() => setListMode('postsAndReplies')}
        >
          {t('Notes & Replies')}
        </div>
        <div
          className={`w-1/3 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${listMode === 'pictures' ? '' : 'text-muted-foreground'}`}
          onClick={() => setListMode('pictures')}
        >
          {t('Pictures')}
        </div>
      </div>
      <div
        className={`w-1/3 px-4 sm:px-6 transition-transform duration-500 ${listMode === 'postsAndReplies' ? 'translate-x-full' : listMode === 'pictures' ? 'translate-x-[200%]' : ''} `}
      >
        <div className="w-full h-1 bg-primary rounded-full" />
      </div>
    </div>
  )
}

function PictureNoteCardMasonry({
  events,
  columnCount,
  className
}: {
  events: Event[]
  columnCount: 2 | 3
  className?: string
}) {
  const columns = useMemo(() => {
    const newColumns: ReactNode[][] = Array.from({ length: columnCount }, () => [])
    events.forEach((event, i) => {
      newColumns[i % columnCount].push(
        <PictureNoteCard key={event.id} className="w-full" event={event} />
      )
    })
    return newColumns
  }, [events, columnCount])

  return (
    <div
      className={cn(
        'grid',
        columnCount === 2 ? 'grid-cols-2 gap-2' : 'grid-cols-3 gap-4',
        className
      )}
    >
      {columns.map((column, i) => (
        <div key={i} className={columnCount === 2 ? 'space-y-2' : 'space-y-4'}>
          {column}
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton({ isPictures }: { isPictures: boolean }) {
  const { t } = useTranslation()

  if (isPictures) {
    return <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  }

  return (
    <div className="px-4 py-3">
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
  )
}
