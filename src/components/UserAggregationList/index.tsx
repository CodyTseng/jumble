import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { isMentioningMutedUsers } from '@/lib/event'
import { toNote, toUserAggregationDetail } from '@/lib/link'
import { cn, isTouchDevice } from '@/lib/utils'
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
import { History, Loader, Pin, PinOff } from 'lucide-react'
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
const SHOW_COUNT = 20

export type TUserAggregationListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}

const UserAggregationList = forwardRef<
  TUserAggregationListRef,
  {
    subRequests: TFeedSubRequest[]
    showKinds?: number[]
    filterFn?: (event: Event) => boolean
    filterMutedNotes?: boolean
  }
>(({ subRequests, showKinds, filterFn, filterMutedNotes = true }, ref) => {
  const { t } = useTranslation()
  const { startLogin } = useNostr()
  const { push } = useSecondaryPage()
  const { hideUntrustedNotes, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { isEventDeleted } = useDeletedEvent()
  const [since, setSince] = useState(() => dayjs().subtract(1, 'day').unix())
  const [events, setEvents] = useState<Event[]>([])
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [showLoadingBar, setShowLoadingBar] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [pinnedPubkeys, setPinnedPubkeys] = useState<Set<string>>(
    new Set(userAggregationService.getPinnedPubkeys())
  )
  const feedId = useMemo(() => {
    return userAggregationService.getFeedId(subRequests, showKinds)
  }, [JSON.stringify(subRequests), JSON.stringify(showKinds)])
  const bottomRef = useRef<HTMLDivElement | null>(null)
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
    return () => {
      userAggregationService.clearAggregations(feedId)
    }
  }, [feedId])

  useEffect(() => {
    if (!subRequests.length) return

    setPinnedPubkeys(new Set(userAggregationService.getPinnedPubkeys()))
    setSince(dayjs().subtract(1, 'day').unix())

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
  }, [feedId, refreshCount])

  useEffect(() => {
    if (
      loading ||
      !timelineKey ||
      !events.length ||
      events[events.length - 1].created_at <= since
    ) {
      return
    }

    const until = events[events.length - 1].created_at - 1

    setLoading(true)
    client.loadMoreTimeline(timelineKey, until, LIMIT).then((moreEvents) => {
      setEvents((oldEvents) => [...oldEvents, ...moreEvents])
      setLoading(false)
    })
  }, [loading, timelineKey, events, since])

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

  const lastXDays = useMemo(() => {
    return dayjs().diff(dayjs.unix(since), 'day')
  }, [since])

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => evt.created_at >= since && !shouldHideEvent(evt))
  }, [events, since, shouldHideEvent])

  const aggregations = useMemo(() => {
    const aggs = userAggregationService.aggregateByUser(filteredEvents)
    userAggregationService.saveAggregations(feedId, aggs)

    const pinned: TUserAggregation[] = []
    const unpinned: TUserAggregation[] = []

    aggs.forEach((agg) => {
      if (pinnedPubkeys.has(agg.pubkey)) {
        pinned.push(agg)
      } else {
        unpinned.push(agg)
      }
    })

    return [...pinned, ...unpinned]
  }, [feedId, filteredEvents, pinnedPubkeys])

  const displayedAggregations = useMemo(() => {
    return aggregations.slice(0, showCount)
  }, [aggregations, showCount])

  const hasMore = useMemo(() => {
    return aggregations.length > displayedAggregations.length
  }, [aggregations, displayedAggregations])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }
    if (!hasMore) return

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setShowCount((count) => count + SHOW_COUNT)
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
  }, [hasMore])

  const handleViewUser = (agg: TUserAggregation) => {
    // Mark as viewed when user clicks
    userAggregationService.markAsViewed(feedId, agg.pubkey)

    if (agg.count === 1) {
      const evt = agg.events[0]
      if (evt.kind !== kinds.Repost && evt.kind !== kinds.GenericRepost) {
        push(toNote(agg.events[0]))
        return
      }
    }

    push(toUserAggregationDetail(feedId, agg.pubkey))
  }

  const handleLoadEarlier = () => {
    setSince((prevSince) => dayjs.unix(prevSince).subtract(1, 'day').unix())
    setShowCount(SHOW_COUNT)
  }

  const list = (
    <div className="min-h-screen">
      {displayedAggregations.map((agg) => (
        <UserAggregationItem
          key={agg.pubkey}
          feedId={feedId}
          aggregation={agg}
          onClick={() => handleViewUser(agg)}
        />
      ))}
      {loading || hasMore ? (
        <div ref={bottomRef}>
          <UserAggregationItemSkeleton />
        </div>
      ) : displayedAggregations.length === 0 ? (
        <div className="flex justify-center w-full mt-2">
          <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
            {t('Reload')}
          </Button>
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground mt-2">{t('no more notes')}</div>
      )}
    </div>
  )

  return (
    <div>
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      {showLoadingBar && <LoadingBar />}
      <div className="border-b h-12 pl-4 pr-1 flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground flex items-center gap-1.5 min-w-0">
          <span className="font-medium text-foreground">
            {lastXDays === 1 ? t('Last 24 hours') : t('Last {{count}} days', { count: lastXDays })}
          </span>
          ·
          <span>
            {filteredEvents.length} {t('notes')}
          </span>
        </div>
        <Button
          variant="ghost"
          className="h-10 px-3 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
          disabled={showLoadingBar}
          onClick={handleLoadEarlier}
        >
          {showLoadingBar ? <Loader className="animate-spin" /> : <History />}
          {t('Load earlier')}
        </Button>
      </div>
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
  feedId,
  aggregation,
  onClick
}: {
  feedId: string
  aggregation: TUserAggregation
  onClick: () => void
}) {
  const { t } = useTranslation()
  const [hasNewEvents, setHasNewEvents] = useState(true)
  const [isPinned, setIsPinned] = useState(userAggregationService.isPinned(aggregation.pubkey))

  useEffect(() => {
    const update = () => {
      const lastViewedTime = userAggregationService.getLastViewedTime(feedId, aggregation.pubkey)
      setHasNewEvents(aggregation.lastEventTime > lastViewedTime)
    }

    const unSub = userAggregationService.subscribeViewedTimeChange(
      feedId,
      aggregation.pubkey,
      () => {
        update()
      }
    )

    update()

    return unSub
  }, [feedId, aggregation])

  const onTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPinned) {
      userAggregationService.unpinUser(aggregation.pubkey)
      setIsPinned(false)
    } else {
      userAggregationService.pinUser(aggregation.pubkey)
      setIsPinned(true)
    }
  }

  const onToggleViewed = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasNewEvents) {
      userAggregationService.markAsViewed(feedId, aggregation.pubkey)
    } else {
      userAggregationService.markAsUnviewed(feedId, aggregation.pubkey)
    }
  }

  return (
    <div
      className="group relative flex items-center gap-4 px-4 py-3 border-b hover:bg-accent/30 cursor-pointer transition-all duration-200"
      onClick={onClick}
    >
      <UserAvatar userId={aggregation.pubkey} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Username
          userId={aggregation.pubkey}
          className="font-semibold text-base truncate max-w-fit"
          skeletonClassName="h-4"
        />
        <FormattedTimestamp
          timestamp={aggregation.lastEventTime}
          className="text-sm text-muted-foreground"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onTogglePin}
        className={`flex-shrink-0 ${
          isPinned
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title={isPinned ? t('Unpin') : t('Pin')}
      >
        {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
      </Button>

      <button
        className={cn(
          'flex-shrink-0 size-10 rounded-full font-bold tabular-nums text-primary border border-primary/80 bg-primary/10 hover:border-primary hover:bg-primary/20 flex flex-col items-center justify-center transition-colors',
          !hasNewEvents &&
            'border-muted-foreground/80 text-muted-foreground/80 bg-muted-foreground/10 hover:border-muted-foreground hover:text-muted-foreground hover:bg-muted-foreground/20'
        )}
        onClick={onToggleViewed}
      >
        {aggregation.count > 99 ? '99+' : aggregation.count}
      </button>
    </div>
  )
}

function UserAggregationItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-36 my-1" />
        <Skeleton className="h-3 w-14 my-1" />
      </div>
      <Skeleton className="size-10 rounded-full" />
    </div>
  )
}
