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
import relayInfoService from '@/services/relay-info.service'
import storage from '@/services/local-storage.service'
import { TNoteListMode } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import NoteCard from '../NoteCard'
import PictureNoteCard from '../PictureNoteCard'

const NORMAL_RELAY_LIMIT = 100
const ALGO_RELAY_LIMIT = 500
const PICTURE_NOTE_LIMIT = 30

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
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState(true)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const isPictures = useMemo(() => listMode === 'pictures', [listMode])
  const noteFilter = useMemo(() => {
    if (isPictures) {
      return {
        kinds: [PICTURE_EVENT_KIND],
        limit: PICTURE_NOTE_LIMIT,
        ...filter
      }
    }
    return {
      kinds: [kinds.ShortTextNote, kinds.Repost, PICTURE_EVENT_KIND],
      limit: NORMAL_RELAY_LIMIT,
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
      const filter = areAlgoRelays ? { ...noteFilter, limit: ALGO_RELAY_LIMIT } : noteFilter

      let eventCount = 0
      const { closer, timelineKey } = await client.subscribeTimeline(
        [...relayUrls],
        filter,
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
    if (!timelineKey || refreshing || !hasMore) return

    const newEvents = await client.loadMoreTimeline(
      timelineKey,
      events.length ? events[events.length - 1].created_at - 1 : dayjs().unix(),
      noteFilter.limit
    )
    if (newEvents.length === 0) {
      setHasMore(false)
      return
    }
    setEvents((oldEvents) => [...oldEvents, ...newEvents])
  }, [timelineKey, refreshing, hasMore, events, noteFilter])

  useEffect(() => {
    if (refreshing) return

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
  }, [refreshing, loadMore])

  const showNewEvents = () => {
    setEvents((oldEvents) => [...newEvents, ...oldEvents])
    setNewEvents([])
  }

  return (
    <div className={className}>
      <ListModeSwitch
        listMode={listMode}
        setListMode={(listMode) => {
          setListMode(listMode)
          topRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
          storage.setNoteListMode(listMode)
        }}
      />
      <div ref={topRef} />
      <PullToRefresh
        onRefresh={async () => {
          setRefreshCount((count) => count + 1)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }}
        pullingContent=""
      >
        <div>
          {newEvents.filter((event: Event) => {
            return (
              (!filterMutedNotes || !mutePubkeys.includes(event.pubkey)) &&
              (listMode !== 'posts' || !isReplyNoteEvent(event))
            )
          }).length > 0 && (
            <div className="flex justify-center w-full my-2">
              <Button size="lg" onClick={showNewEvents}>
                {t('show new notes')}
              </Button>
            </div>
          )}
          {isPictures ? (
            <PictureNoteCardMasonry
              className="px-2 sm:px-4 mt-2"
              columnCount={isLargeScreen ? 3 : 2}
              events={events}
            />
          ) : (
            <div>
              {events
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
  const { isLargeScreen } = useScreenSize()

  if (isPictures) {
    return (
      <div
        className={cn(
          'px-2 sm:px-4 grid',
          isLargeScreen ? 'grid-cols-3 gap-4' : 'grid-cols-2 gap-2'
        )}
      >
        {[...Array(isLargeScreen ? 3 : 2)].map((_, i) => (
          <div key={i}>
            <Skeleton className="rounded-lg w-full aspect-[6/8]" />
            <div className="p-2">
              <Skeleton className="w-32 h-5" />
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="w-16 h-3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center space-x-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="w-10 h-4" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
      <Skeleton className="w-full h-5 mt-2" />
      <Skeleton className="w-2/3 h-5 mt-2" />
    </div>
  )
}
