import NewNotesButton from '@/components/NewNotesButton'
import { Button } from '@/components/ui/button'
import {
  getReplaceableCoordinateFromEvent,
  isMentioningMutedUsers,
  isReplaceableEvent,
  isReplyNoteEvent
} from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
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
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'

const LIMIT = 100
const ALGO_LIMIT = 500
const SHOW_COUNT = 10

const NoteList = forwardRef(
  (
    {
      subRequests,
      showKinds,
      filterMutedNotes = true,
      hideReplies = false,
      hideUntrustedNotes = false,
      areAlgoRelays = false
    }: {
      subRequests: TFeedSubRequest[]
      showKinds: number[]
      filterMutedNotes?: boolean
      hideReplies?: boolean
      hideUntrustedNotes?: boolean
      areAlgoRelays?: boolean
    },
    ref
  ) => {
    const { t } = useTranslation()
    const { startLogin } = useNostr()
    const { isUserTrusted } = useUserTrust()
    const { mutePubkeySet } = useMuteList()
    const { hideContentMentioningMutedUsers } = useContentPolicy()
    const { isEventDeleted } = useDeletedEvent()
    const [events, setEvents] = useState<Event[]>([])
    const [newEvents, setNewEvents] = useState<Event[]>([])
    const [hasMore, setHasMore] = useState<boolean>(true)
    const [loading, setLoading] = useState(true)
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const [refreshCount, setRefreshCount] = useState(0)
    const [showCount, setShowCount] = useState(SHOW_COUNT)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)

    const shouldHideEvent = useCallback(
      (evt: Event) => {
        if (isEventDeleted(evt)) return true
        if (hideReplies && isReplyNoteEvent(evt)) return true
        if (hideUntrustedNotes && !isUserTrusted(evt.pubkey)) return true
        if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return true
        if (
          filterMutedNotes &&
          hideContentMentioningMutedUsers &&
          isMentioningMutedUsers(evt, mutePubkeySet)
        ) {
          return true
        }

        return false
      },
      [hideReplies, hideUntrustedNotes, mutePubkeySet, isEventDeleted]
    )

    const filteredEvents = useMemo(() => {
      const idSet = new Set<string>()

      return events.slice(0, showCount).filter((evt) => {
        if (shouldHideEvent(evt)) return false

        const id = isReplaceableEvent(evt.kind) ? getReplaceableCoordinateFromEvent(evt) : evt.id
        if (idSet.has(id)) {
          return false
        }
        idSet.add(id)
        return true
      })
    }, [events, showCount, shouldHideEvent])

    const filteredNewEvents = useMemo(() => {
      const idSet = new Set<string>()

      return newEvents.filter((event: Event) => {
        if (shouldHideEvent(event)) return false

        const id = isReplaceableEvent(event.kind)
          ? getReplaceableCoordinateFromEvent(event)
          : event.id
        if (idSet.has(id)) {
          return false
        }
        idSet.add(id)
        return true
      })
    }, [events, showCount, shouldHideEvent])

    const scrollToTop = (behavior: ScrollBehavior = 'instant') => {
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior, block: 'start' })
      }, 20)
    }

    useImperativeHandle(ref, () => ({ scrollToTop }), [])

    useEffect(() => {
      if (!subRequests.length) return

      async function init() {
        setLoading(true)
        setEvents([])
        setNewEvents([])
        setHasMore(true)

        if (showKinds.length === 0) {
          setLoading(false)
          setHasMore(false)
          return () => {}
        }

        const { closer, timelineKey } = await client.subscribeTimeline(
          subRequests.map(({ urls, filter }) => ({
            urls,
            filter: {
              kinds: showKinds,
              ...filter,
              limit: areAlgoRelays ? ALGO_LIMIT : LIMIT
            }
          })),
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                setEvents(events)
              }
              if (areAlgoRelays) {
                setHasMore(false)
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
    }, [JSON.stringify(subRequests), refreshCount, showKinds])

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 0.1
      }

      const loadMore = async () => {
        if (showCount < events.length) {
          setShowCount((prev) => prev + SHOW_COUNT)
          // preload more
          if (events.length - showCount > SHOW_COUNT * 5) {
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
    }, [loading, hasMore, events, showCount, timelineKey])

    const showNewEvents = () => {
      setEvents((oldEvents) => [...newEvents, ...oldEvents])
      setNewEvents([])
      setTimeout(() => {
        scrollToTop('smooth')
      }, 0)
    }

    return (
      <div>
        {filteredNewEvents.length > 0 && (
          <NewNotesButton newEvents={filteredNewEvents} onClick={showNewEvents} />
        )}
        <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
        <PullToRefresh
          onRefresh={async () => {
            setRefreshCount((count) => count + 1)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }}
          pullingContent=""
        >
          <div className="min-h-screen">
            {filteredEvents.map((event) => (
              <NoteCard
                key={event.id}
                className="w-full"
                event={event}
                filterMutedNotes={filterMutedNotes}
              />
            ))}
            {hasMore || loading ? (
              <div ref={bottomRef}>
                <NoteCardLoadingSkeleton />
              </div>
            ) : events.length ? (
              <div className="text-center text-sm text-muted-foreground mt-2">
                {t('no more notes')}
              </div>
            ) : (
              <div className="flex justify-center w-full mt-2">
                <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
                  {t('reload notes')}
                </Button>
              </div>
            )}
          </div>
        </PullToRefresh>
        <div className="h-40" />
      </div>
    )
  }
)
NoteList.displayName = 'NoteList'
export default NoteList

export type TNoteListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
}
