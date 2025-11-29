import { Button } from '@/components/ui/button'
import { DIVINE_VIDEO_KIND, DIVINE_RELAY_URL, DivineSortMode, createSortSearch, hasPlayableVideo } from '@/lib/divine-video'
import { isTouchDevice } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { VideoFeedProvider } from '@/providers/VideoFeedProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
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
import PullToRefresh from 'react-simple-pull-to-refresh'
import NewNotesButton from '../NewNotesButton'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'

const LIMIT = 50
const SHOW_COUNT = 10

export type TDivineVideoListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}

interface DivineVideoListProps {
  hashtag?: string
  pubkey?: string
  hideUntrustedNotes?: boolean
  filterMutedNotes?: boolean
  sortMode?: DivineSortMode
}

const DivineVideoList = forwardRef<TDivineVideoListRef, DivineVideoListProps>(
  ({ hashtag, pubkey, hideUntrustedNotes = false, filterMutedNotes = true, sortMode }, ref) => {
    const { t } = useTranslation()
    const { startLogin } = useNostr()
    const { isUserTrusted } = useUserTrust()
    const { mutePubkeySet } = useMuteList()
    const [events, setEvents] = useState<Event[]>([])
    const [newEvents, setNewEvents] = useState<Event[]>([])
    const [hasMore, setHasMore] = useState<boolean>(true)
    const [loading, setLoading] = useState(true)
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const [refreshCount, setRefreshCount] = useState(0)
    const [showCount, setShowCount] = useState(SHOW_COUNT)
    const supportTouch = useMemo(() => isTouchDevice(), [])
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)

    const shouldHideEvent = useCallback(
      (evt: Event) => {
        if (hideUntrustedNotes && !isUserTrusted(evt.pubkey)) return true
        if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return true
        // Filter out videos that don't have any playable URLs
        if (!hasPlayableVideo(evt)) return true
        return false
      },
      [hideUntrustedNotes, filterMutedNotes, mutePubkeySet, isUserTrusted]
    )

    // Filter events
    const filteredEvents = useMemo(() => {
      return events.filter((evt) => !shouldHideEvent(evt))
    }, [events, shouldHideEvent])

    const slicedEvents = useMemo(() => {
      return filteredEvents.slice(0, showCount)
    }, [filteredEvents, showCount])

    const filteredNewEvents = useMemo(() => {
      return newEvents.filter((event) => !shouldHideEvent(event))
    }, [newEvents, shouldHideEvent])

    const scrollToTop = (behavior: ScrollBehavior = 'instant') => {
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior, block: 'start' })
      }, 20)
    }

    const refresh = () => {
      scrollToTop()
      setTimeout(() => {
        setRefreshCount((count) => count + 1)
      }, 500)
    }

    useImperativeHandle(ref, () => ({ scrollToTop, refresh }), [])

    useEffect(() => {
      async function init() {
        setLoading(true)
        setEvents([])
        setNewEvents([])
        setHasMore(true)

        const filter: { kinds: number[]; '#t'?: string[]; authors?: string[]; search?: string; '#platform'?: string[] } = {
          kinds: [DIVINE_VIDEO_KIND]
        }

        if (hashtag) {
          filter['#t'] = [hashtag.toLowerCase()]
        }

        if (pubkey) {
          filter.authors = [pubkey]
        }

        // Add NIP-50 search sort mode if provided
        if (sortMode) {
          filter.search = createSortSearch(sortMode)
          // For 'top' mode, filter for Classic archived Vines only
          if (sortMode === 'top') {
            filter['#platform'] = ['vine']
          }
        }

        const { closer, timelineKey } = await client.subscribeTimeline(
          [
            {
              urls: [DIVINE_RELAY_URL],
              filter: {
                ...filter,
                limit: LIMIT
              }
            }
          ],
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                setEvents(events)
              }
              if (eosed) {
                setLoading(false)
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
            // When using NIP-50 sort modes, the relay handles sorting, so we don't need client-side sort
            needSort: !sortMode
          }
        )
        setTimelineKey(timelineKey)
        return closer
      }

      const promise = init()
      return () => {
        promise.then((closer) => closer())
      }
    }, [hashtag, pubkey, refreshCount, sortMode])

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 0.1
      }

      const loadMore = async () => {
        if (showCount < filteredEvents.length) {
          setShowCount((prev) => prev + SHOW_COUNT)
          if (filteredEvents.length - showCount > LIMIT / 2) {
            return
          }
        }

        if (!timelineKey || loading || !hasMore) return
        setLoading(true)
        const newEvents = await client.loadMoreTimeline(
          timelineKey,
          events.length ? events[events.length - 1].created_at - 1 : dayjs().unix(),
          LIMIT
        )
        setLoading(false)
        if (newEvents.length === 0) {
          setHasMore(false)
          return
        }
        setEvents((oldEvents) => [...oldEvents, ...newEvents])
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
    }, [loading, hasMore, events, filteredEvents, showCount, timelineKey])

    const showNewEvents = () => {
      setEvents((oldEvents) => [...newEvents, ...oldEvents])
      setNewEvents([])
      setTimeout(() => {
        scrollToTop('smooth')
      }, 0)
    }

    const list = (
      <VideoFeedProvider isVideoFeed={true}>
        <div className="min-h-screen">
          {slicedEvents.map((event) => (
            <NoteCard key={event.id} event={event} className="w-full" />
          ))}
          {hasMore || loading ? (
            <div ref={bottomRef}>
              <NoteCardLoadingSkeleton />
              <NoteCardLoadingSkeleton />
            </div>
          ) : filteredEvents.length ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              {t('no more notes')}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">No videos found</p>
              <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
                {t('Reload')}
              </Button>
            </div>
          )}
        </div>
      </VideoFeedProvider>
    )

    return (
      <div>
        <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
        {supportTouch ? (
          <PullToRefresh
            onRefresh={async () => {
              refresh()
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }}
            pullingContent=""
          >
            {list}
          </PullToRefresh>
        ) : (
          list
        )}
        <div className="h-40" />
        {filteredNewEvents.length > 0 && (
          <NewNotesButton newEvents={filteredNewEvents} onClick={showNewEvents} />
        )}
      </div>
    )
  }
)

DivineVideoList.displayName = 'DivineVideoList'
export default DivineVideoList
