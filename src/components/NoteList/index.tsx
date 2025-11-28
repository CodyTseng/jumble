import NewNotesButton from '@/components/NewNotesButton'
import { Button } from '@/components/ui/button'
import { hasPlayableVideo } from '@/lib/divine-video'
import { getEventKey, getKeyFromTag, isMentioningMutedUsers, isReplyNoteEvent } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { isTouchDevice } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useReply } from '@/providers/ReplyProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { decode } from 'nostr-tools/nip19'
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
import { toast } from 'sonner'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'
import PinnedNoteCard from '../PinnedNoteCard'

const LIMIT = 200
const ALGO_LIMIT = 500
const SHOW_COUNT = 10

export type TNoteListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}

const NoteList = forwardRef<
  TNoteListRef,
  {
    subRequests: TFeedSubRequest[]
    showKinds?: number[]
    filterMutedNotes?: boolean
    hideReplies?: boolean
    hideUntrustedNotes?: boolean
    areAlgoRelays?: boolean
    showRelayCloseReason?: boolean
    pinnedEventIds?: string[]
    filterFn?: (event: Event) => boolean
    showNewNotesDirectly?: boolean
  }
>(
  (
    {
      subRequests,
      showKinds,
      filterMutedNotes = true,
      hideReplies = false,
      hideUntrustedNotes = false,
      areAlgoRelays = false,
      showRelayCloseReason = false,
      pinnedEventIds,
      filterFn,
      showNewNotesDirectly = false
    },
    ref
  ) => {
    const { t } = useTranslation()
    const { startLogin } = useNostr()
    const { isUserTrusted } = useUserTrust()
    const { mutePubkeySet } = useMuteList()
    const { hideContentMentioningMutedUsers } = useContentPolicy()
    const { isEventDeleted } = useDeletedEvent()
    const { addReplies } = useReply()
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
        const pinnedEventHexIdSet = new Set()
        pinnedEventIds?.forEach((id) => {
          try {
            const { type, data } = decode(id)
            if (type === 'nevent') {
              pinnedEventHexIdSet.add(data.id)
            }
          } catch {
            // ignore
          }
        })

        if (pinnedEventHexIdSet.has(evt.id)) return true
        if (isEventDeleted(evt)) return true
        if (hideUntrustedNotes && !isUserTrusted(evt.pubkey)) return true
        if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return true
        if (
          filterMutedNotes &&
          hideContentMentioningMutedUsers &&
          isMentioningMutedUsers(evt, mutePubkeySet)
        ) {
          return true
        }
        if (filterFn && !filterFn(evt)) {
          return true
        }
        // Filter out videos that only have HLS streams (not playable in browser)
        if (!hasPlayableVideo(evt)) return true

        return false
      },
      [hideUntrustedNotes, mutePubkeySet, JSON.stringify(pinnedEventIds), isEventDeleted, filterFn]
    )

    const filteredNotes = useMemo(() => {
      // Store processed event keys to avoid duplicates
      const keySet = new Set<string>()
      // Map to track reposters for each event key
      const repostersMap = new Map<string, Set<string>>()
      // Final list of filtered events
      const filteredEvents: Event[] = []
      const keys: string[] = []

      events.forEach((evt) => {
        const key = getEventKey(evt)
        if (keySet.has(key)) return
        keySet.add(key)

        if (shouldHideEvent(evt)) return
        if (hideReplies && isReplyNoteEvent(evt)) return
        if (evt.kind !== kinds.Repost && evt.kind !== kinds.GenericRepost) {
          filteredEvents.push(evt)
          keys.push(key)
          return
        }

        let targetEventKey: string | undefined
        let eventFromContent: Event | null = null
        const targetTag = evt.tags.find(tagNameEquals('a')) ?? evt.tags.find(tagNameEquals('e'))
        if (targetTag) {
          targetEventKey = getKeyFromTag(targetTag)
        } else {
          // Attempt to extract the target event from the repost content
          if (evt.content) {
            try {
              eventFromContent = JSON.parse(evt.content) as Event
            } catch {
              eventFromContent = null
            }
          }
          if (eventFromContent) {
            if (
              eventFromContent.kind === kinds.Repost ||
              eventFromContent.kind === kinds.GenericRepost
            ) {
              return
            }
            if (shouldHideEvent(evt)) return

            targetEventKey = getEventKey(eventFromContent)
          }
        }

        if (targetEventKey) {
          // Add to reposters map
          const reposters = repostersMap.get(targetEventKey)
          if (reposters) {
            reposters.add(evt.pubkey)
          } else {
            repostersMap.set(targetEventKey, new Set([evt.pubkey]))
          }

          // If the target event is not already included, add it now
          if (!keySet.has(targetEventKey)) {
            filteredEvents.push(evt)
            keys.push(targetEventKey)
            keySet.add(targetEventKey)
          }
        }
      })

      return filteredEvents.map((evt, i) => {
        const key = keys[i]
        return { key, event: evt, reposters: Array.from(repostersMap.get(key) ?? []) }
      })
    }, [events, shouldHideEvent, hideReplies])

    const slicedNotes = useMemo(() => {
      return filteredNotes.slice(0, showCount)
    }, [filteredNotes, showCount])

    const filteredNewEvents = useMemo(() => {
      const keySet = new Set<string>()

      return newEvents.filter((event: Event) => {
        if (shouldHideEvent(event)) return false
        if (hideReplies && isReplyNoteEvent(event)) return false

        const key = getEventKey(event)
        if (keySet.has(key)) {
          return false
        }
        keySet.add(key)
        return true
      })
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
      if (!subRequests.length) return

      async function init() {
        setLoading(true)
        setEvents([])
        setNewEvents([])
        setHasMore(true)

        if (showKinds?.length === 0 && subRequests.every(({ filter }) => !filter.kinds)) {
          setLoading(false)
          setHasMore(false)
          return () => {}
        }

        const { closer, timelineKey } = await client.subscribeTimeline(
          subRequests.map(({ urls, filter }) => ({
            urls,
            filter: {
              kinds: showKinds ?? [],
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
                addReplies(events)
              }
            },
            onNew: (event) => {
              if (showNewNotesDirectly) {
                setEvents((oldEvents) =>
                  oldEvents.some((e) => e.id === event.id) ? oldEvents : [event, ...oldEvents]
                )
              } else {
                setNewEvents((oldEvents) =>
                  [event, ...oldEvents].sort((a, b) => b.created_at - a.created_at)
                )
              }
              addReplies([event])
            },
            onClose: (url, reason) => {
              if (!showRelayCloseReason) return
              // ignore reasons from nostr-tools
              if (
                [
                  'closed by caller',
                  'relay connection errored',
                  'relay connection closed',
                  'pingpong timed out',
                  'relay connection closed by us'
                ].includes(reason)
              ) {
                return
              }

              toast.error(`${url}: ${reason}`)
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
    }, [JSON.stringify(subRequests), refreshCount, JSON.stringify(showKinds)])

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
          if (events.length - showCount > LIMIT / 2) {
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

    const list = (
      <div className="min-h-screen">
        {pinnedEventIds?.map((id) => <PinnedNoteCard key={id} eventId={id} className="w-full" />)}
        {slicedNotes.map(({ key, event, reposters }) => (
          <NoteCard
            key={key}
            className="w-full"
            event={event}
            filterMutedNotes={filterMutedNotes}
            reposters={reposters}
          />
        ))}
        {hasMore || loading ? (
          <div ref={bottomRef}>
            <NoteCardLoadingSkeleton />
          </div>
        ) : events.length ? (
          <div className="text-center text-sm text-muted-foreground mt-2">{t('no more notes')}</div>
        ) : (
          <div className="flex justify-center w-full mt-2">
            <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
              {t('Reload')}
            </Button>
          </div>
        )}
      </div>
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
NoteList.displayName = 'NoteList'
export default NoteList
