import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { isMentioningMutedUsers } from '@/lib/event'
import { toNote, toUserAggregationDetail } from '@/lib/link'
import { isTouchDevice } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import userAggregationService, { TUserAggregation } from '@/services/user-aggregation.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { Pin, PinOff } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
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
import { LoadingBar } from '../LoadingBar'

const LIMIT = 500

export type TUserAggregationListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}

const UserAggregationList = forwardRef<
  TUserAggregationListRef,
  {
    subRequests: TFeedSubRequest[]
    feedId: string
    showKinds?: number[]
    filterFn?: (event: Event) => boolean
    filterMutedNotes?: boolean
  }
>(({ subRequests, feedId, showKinds, filterFn, filterMutedNotes = true }, ref) => {
  const { t } = useTranslation()
  const { startLogin } = useNostr()
  const { push } = useSecondaryPage()
  const { hideUntrustedNotes, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { isEventDeleted } = useDeletedEvent()
  const [events, setEvents] = useState<Event[]>([])
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [showLoadingBar, setShowLoadingBar] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [pinnedPubkeys, setPinnedPubkeys] = useState<Set<string>>(
    new Set(userAggregationService.getPinnedPubkeys())
  )
  const topRef = useRef<HTMLDivElement | null>(null)

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

      if (showKinds?.length === 0 && subRequests.every(({ filter }) => !filter.kinds)) {
        setLoading(false)
        return () => {}
      }

      const { closer, timelineKey } = await client.subscribeTimeline(
        subRequests.map(({ urls, filter }) => ({
          urls,
          filter: {
            kinds: showKinds ?? [],
            ...filter,
            limit: LIMIT
          }
        })),
        {
          onEvents: (events, eosed) => {
            if (events.length > 0) {
              setEvents(events)
            }
            if (eosed) {
              setLoading(false)
            }
          },
          onNew: (event) => {
            setEvents((oldEvents) => {
              const newEvents = oldEvents.some((e) => e.id === event.id)
                ? oldEvents
                : [event, ...oldEvents]
              return newEvents
            })
          }
        },
        {
          startLogin,
          needSort: true
        }
      )
      setTimelineKey(timelineKey)

      return closer
    }

    const promise = init()
    return () => {
      promise.then((closer) => closer())
    }
  }, [JSON.stringify(subRequests), JSON.stringify(showKinds), feedId, refreshCount])

  useEffect(() => {
    if (
      loading ||
      !timelineKey ||
      !events.length ||
      events[events.length - 1].created_at <= dayjs().subtract(1, 'day').unix()
    ) {
      return
    }

    const until = events[events.length - 1].created_at - 1

    setLoading(true)
    client.loadMoreTimeline(timelineKey, until, LIMIT).then((moreEvents) => {
      setEvents((oldEvents) => [...oldEvents, ...moreEvents])
      setLoading(false)
    })
  }, [loading, timelineKey, events])

  useEffect(() => {
    const unsubscribe = userAggregationService.subscribe(() => {
      setPinnedPubkeys(new Set(userAggregationService.getPinnedPubkeys()))
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (loading) {
      setShowLoadingBar(true)
      return
    }

    const timeout = setTimeout(() => {
      setShowLoadingBar(false)
    }, 1000)

    return () => clearTimeout(timeout)
  }, [loading])

  const shouldHideEvent = useCallback(
    (evt: Event) => {
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

      return false
    },
    [hideUntrustedNotes, mutePubkeySet, isEventDeleted, filterFn]
  )

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => !shouldHideEvent(evt))
  }, [events, shouldHideEvent])

  const aggregations = useMemo(() => {
    const aggs = userAggregationService.aggregateByUser(filteredEvents)
    userAggregationService.setCachedEvents(feedId, aggs)
    return aggs
  }, [feedId, filteredEvents])

  const sortedAggregations = useMemo(() => {
    return userAggregationService.sortWithPinned(aggregations)
  }, [aggregations, pinnedPubkeys])

  const handleTogglePin = (pubkey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    userAggregationService.togglePin(pubkey)
  }

  const handleViewUser = (agg: TUserAggregation) => {
    if (agg.count === 1) {
      const evt = agg.events[0]
      if (evt.kind !== kinds.Repost && evt.kind !== kinds.GenericRepost) {
        push(toNote(agg.events[0]))
        return
      }
    }

    push(toUserAggregationDetail(feedId, agg.pubkey))
  }

  const list = (
    <div className="min-h-screen">
      {sortedAggregations.map((agg) => (
        <UserAggregationItem
          key={agg.pubkey}
          aggregation={agg}
          isPinned={pinnedPubkeys.has(agg.pubkey)}
          onTogglePin={handleTogglePin}
          onClick={() => handleViewUser(agg)}
        />
      ))}
      {loading && <UserAggregationItemSkeleton />}
      {!loading &&
        (sortedAggregations.length === 0 ? (
          <div className="flex justify-center w-full mt-2">
            <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
              {t('Reload')}
            </Button>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground mt-2">{t('no more notes')}</div>
        ))}
    </div>
  )

  return (
    <div>
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      {showLoadingBar && <LoadingBar />}
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
    </div>
  )
})
UserAggregationList.displayName = 'UserAggregationList'
export default UserAggregationList

function UserAggregationItem({
  aggregation,
  isPinned,
  onTogglePin,
  onClick
}: {
  aggregation: TUserAggregation
  isPinned: boolean
  onTogglePin: (pubkey: string, e: React.MouseEvent) => void
  onClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="group relative flex items-center gap-4 px-4 py-3 border-b hover:bg-accent/30 cursor-pointer transition-all duration-200"
      onClick={onClick}
    >
      <UserAvatar userId={aggregation.pubkey} className="size-12" />

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <Username
          userId={aggregation.pubkey}
          className="font-semibold text-base truncate max-w-fit"
        />
        <FormattedTimestamp
          timestamp={aggregation.lastEventTime}
          className="text-sm text-muted-foreground"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => onTogglePin(aggregation.pubkey, e)}
        className={`flex-shrink-0 transition-all duration-200 ${
          isPinned
            ? 'opacity-100 text-primary hover:text-primary/80'
            : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'
        }`}
        title={isPinned ? t('Unpin') : t('Pin')}
      >
        {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
      </Button>

      <div className="flex-shrink-0 size-10 rounded-full border border-primary bg-primary/10 flex flex-col items-center justify-center">
        <span className="text font-bold text-primary tabular-nums">{aggregation.count}</span>
      </div>
    </div>
  )
}

function UserAggregationItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="size-10 rounded-full" />
    </div>
  )
}
