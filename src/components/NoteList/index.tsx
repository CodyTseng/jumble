import { Button } from '@/components/ui/button'
import { PICTURE_EVENT_KIND } from '@/constants'
import { isReplyNoteEvent } from '@/lib/event'
import { checkAlgoRelay } from '@/lib/relay'
import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
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
  filterMutedNotes = true
}: {
  relayUrls: string[]
  filter?: Filter
  className?: string
  filterMutedNotes?: boolean
}) {
  const { t } = useTranslation()
  const { isLargeScreen } = useScreenSize()
  const { signEvent, checkLogin } = useNostr()
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

      const relayInfos = await client.fetchRelayInfos(relayUrls)
      const areAlgoRelays = relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo))
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
          signer: async (evt) => {
            const signedEvt = await checkLogin(() => signEvent(evt))
            return signedEvt ?? null
          },
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

  const eventFilter = (event: Event) => {
    return (
      (!filterMutedNotes || !mutePubkeys.includes(event.pubkey)) &&
      (listMode !== 'posts' || !isReplyNoteEvent(event))
    )
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
        <div className="space-y-2 sm:space-y-2">
          {newEvents.filter(eventFilter).length > 0 && (
            <div className="flex justify-center w-full mt-2">
              <Button size="lg" onClick={showNewEvents}>
                {t('show new notes')}
              </Button>
            </div>
          )}
          {isPictures ? (
            <PictureNoteCardMasonry
              className="px-2 sm:px-4"
              columnCount={isLargeScreen ? 3 : 2}
              events={events}
            />
          ) : (
            <div>
              {events.filter(eventFilter).map((event) => (
                <NoteCard key={event.id} className="w-full" event={event} />
              ))}
            </div>
          )}
          <div className="text-center text-sm text-muted-foreground">
            {hasMore || refreshing ? (
              <div ref={bottomRef}>{t('loading...')}</div>
            ) : events.length ? (
              t('no more notes')
            ) : (
              <div className="flex justify-center w-full mt-2">
                <Button size="lg" onClick={() => setRefreshCount((pre) => pre + 1)}>
                  {t('reload notes')}
                </Button>
              </div>
            )}
          </div>
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
        'sticky top-12 bg-background z-10 duration-700 transition-transform',
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
