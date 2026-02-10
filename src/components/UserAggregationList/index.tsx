import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar, { SimpleUserAvatar } from '@/components/UserAvatar'
import Username, { SimpleUsername } from '@/components/Username'
import { isMentioningMutedUsers } from '@/lib/event'
import { toNote, toUserAggregationDetail } from '@/lib/link'
import { mergeTimelines } from '@/lib/timeline'
import { cn, isTouchDevice } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import { usePinnedUsers } from '@/providers/PinnedUsersProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import threadService from '@/services/thread.service'
import userAggregationService, { TUserAggregation } from '@/services/user-aggregation.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { History, Loader, Star } from 'lucide-react'
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
import { toast } from 'sonner'
import { LoadingBar } from '../LoadingBar'
import NewNotesButton from '../NewNotesButton'
import TrustScoreBadge from '../TrustScoreBadge'

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
    filterMutedNotes?: boolean
    areAlgoRelays?: boolean
    showRelayCloseReason?: boolean
    isPubkeyFeed?: boolean
    trustScoreThreshold?: number
    filterFn?: (event: Event) => boolean
  }
>(
  (
    {
      subRequests,
      showKinds,
      filterMutedNotes = true,
      areAlgoRelays = false,
      showRelayCloseReason = false,
      isPubkeyFeed = false,
      trustScoreThreshold,
      filterFn
    },
    ref
  ) => {
    const { t } = useTranslation()
    const active = usePageActive()
    const { pubkey: currentPubkey, startLogin } = useNostr()
    const { push } = useSecondaryPage()
    const { mutePubkeySet } = useMuteList()
    const { pinnedPubkeySet } = usePinnedUsers()
    const { meetsMinTrustScore } = useUserTrust()
    const { hideContentMentioningMutedUsers } = useContentPolicy()
    const { isEventDeleted } = useDeletedEvent()
    const [since, setSince] = useState(() => dayjs().subtract(1, 'day').unix())
    const [storedEvents, setStoredEvents] = useState<Event[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
    const [newEvents, setNewEvents] = useState<Event[]>([])
    const [filteredNewEvents, setFilteredNewEvents] = useState<Event[]>([])
    const [newEventPubkeys, setNewEventPubkeys] = useState<Set<string>>(new Set())
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [showLoadingBar, setShowLoadingBar] = useState(true)
    const [refreshCount, setRefreshCount] = useState(0)
    const [showCount, setShowCount] = useState(SHOW_COUNT)
    const [hasMore, setHasMore] = useState(true)
    const supportTouch = useMemo(() => isTouchDevice(), [])
    const feedId = useMemo(() => {
      return userAggregationService.getFeedId(subRequests, showKinds)
    }, [JSON.stringify(subRequests), JSON.stringify(showKinds)])
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)
    const nonPinnedTopRef = useRef<HTMLDivElement | null>(null)
    const sinceRef = useRef<number | undefined>(undefined)
    sinceRef.current = newEvents.length
      ? newEvents[0].created_at + 1
      : events.length
        ? events[0].created_at + 1
        : undefined

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

      sinceRef.current = undefined
      setSince(dayjs().subtract(1, 'day').unix())
      setStoredEvents([])
      setEvents([])
      setNewEvents([])
      setHasMore(true)
    }, [feedId, refreshCount])

    useEffect(() => {
      if (!subRequests.length || !active) return

      async function init() {
        setLoading(true)

        if (showKinds?.length === 0 && subRequests.every(({ filter }) => !filter.kinds)) {
          setLoading(false)
          setHasMore(false)
          return () => {}
        }

        const since = sinceRef.current

        if (isPubkeyFeed) {
          const storedEvents = await client.getEventsFromIndexed({
            authors: subRequests.flatMap(({ filter }) => filter.authors ?? []),
            kinds: showKinds ?? [],
            since: dayjs().subtract(1, 'day').unix()
          })
          setStoredEvents(storedEvents)
        }

        const preprocessedSubRequests = await Promise.all(
          subRequests.map(async ({ urls, filter }) => {
            const relays = urls.length ? urls : await client.determineRelaysByFilter(filter)
            return {
              urls: relays,
              filter: {
                kinds: showKinds ?? [],
                ...filter,
                limit: LIMIT
              }
            }
          })
        )

        const { closer, timelineKey } = await client.subscribeTimeline(
          preprocessedSubRequests,
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                if (!since) {
                  setEvents(events)
                } else {
                  const newEvents = events.filter((evt) => evt.created_at >= since)
                  setNewEvents((oldEvents) => mergeTimelines([newEvents, oldEvents]))
                }
              }
              if (areAlgoRelays) {
                setHasMore(false)
              }
              if (eosed) {
                setLoading(false)
                threadService.addRepliesToThread(events)
              }
            },
            onNew: (event) => {
              setNewEvents((oldEvents) => mergeTimelines([[event], oldEvents]))
              threadService.addRepliesToThread([event])
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
            needSort: !areAlgoRelays,
            needSaveToDb: isPubkeyFeed
          }
        )
        setTimelineKey(timelineKey)

        return closer
      }

      const promise = init()
      return () => {
        promise.then((closer) => closer())
      }
    }, [feedId, refreshCount, active])

    useEffect(() => {
      if (loading || !hasMore || !timelineKey || !events.length) {
        return
      }

      const until = events[events.length - 1].created_at - 1
      if (until < since) {
        return
      }

      setLoading(true)
      client.loadMoreTimeline(timelineKey, until, LIMIT).then((moreEvents) => {
        if (moreEvents.length === 0) {
          setHasMore(false)
          setLoading(false)
          return
        }
        setEvents((oldEvents) => [...oldEvents, ...moreEvents])
        setLoading(false)
      })
    }, [loading, timelineKey, events, since, hasMore])

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

    const filterEvents = useCallback(
      async (events: Event[]) => {
        const results = await Promise.allSettled(
          events.map(async (evt) => {
            if (evt.pubkey === currentPubkey) return null
            if (evt.created_at < since) return null
            if (isEventDeleted(evt)) return null
            if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return null
            if (
              filterMutedNotes &&
              hideContentMentioningMutedUsers &&
              isMentioningMutedUsers(evt, mutePubkeySet)
            ) {
              return null
            }
            if (filterFn && !filterFn(evt)) return null
            if (
              trustScoreThreshold &&
              !(await meetsMinTrustScore(evt.pubkey, trustScoreThreshold))
            ) {
              return null
            }

            return evt
          })
        )
        return results
          .filter((res) => res.status === 'fulfilled' && res.value !== null)
          .map((res) => (res as PromiseFulfilledResult<Event>).value)
      },
      [
        mutePubkeySet,
        isEventDeleted,
        currentPubkey,
        filterMutedNotes,
        hideContentMentioningMutedUsers,
        isMentioningMutedUsers,
        filterFn,
        meetsMinTrustScore,
        trustScoreThreshold
      ]
    )

    const lastXDays = useMemo(() => {
      return dayjs().diff(dayjs.unix(since), 'day')
    }, [since])

    useEffect(() => {
      const mergedEvents = mergeTimelines([events, storedEvents])
      filterEvents(mergedEvents).then((filtered) => {
        setFilteredEvents(filtered)
      })
    }, [events, storedEvents, filterEvents])

    useEffect(() => {
      filterEvents(newEvents).then((filtered) => {
        setFilteredNewEvents(filtered)
      })
    }, [newEvents, filterEvents])

    const aggregations = useMemo(() => {
      const aggs = userAggregationService.aggregateByUser(filteredEvents)
      userAggregationService.saveAggregations(feedId, aggs)
      return aggs
    }, [feedId, filteredEvents])

    const pinnedAggregations = useMemo(() => {
      return aggregations.filter((agg) => pinnedPubkeySet.has(agg.pubkey))
    }, [aggregations, pinnedPubkeySet])

    const normalAggregations = useMemo(() => {
      return aggregations.filter((agg) => !pinnedPubkeySet.has(agg.pubkey))
    }, [aggregations, pinnedPubkeySet])

    const displayedNormalAggregations = useMemo(() => {
      return normalAggregations.slice(0, showCount)
    }, [normalAggregations, showCount])

    const hasMoreToDisplay = useMemo(() => {
      return normalAggregations.length > displayedNormalAggregations.length
    }, [normalAggregations, displayedNormalAggregations])

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 1
      }
      if (!hasMoreToDisplay) return

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
    }, [hasMoreToDisplay])

    const handleViewUser = (agg: TUserAggregation) => {
      // Mark as viewed when user clicks
      userAggregationService.markAsViewed(feedId, agg.pubkey)
      setNewEventPubkeys((prev) => {
        const newSet = new Set(prev)
        newSet.delete(agg.pubkey)
        return newSet
      })

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

    const showNewEvents = () => {
      const pubkeySet = new Set<string>()
      let hasPinnedUser = false
      newEvents.forEach((evt) => {
        pubkeySet.add(evt.pubkey)
        if (pinnedPubkeySet.has(evt.pubkey)) {
          hasPinnedUser = true
        }
      })
      setNewEventPubkeys(pubkeySet)
      setEvents((oldEvents) => [...newEvents, ...oldEvents])
      setNewEvents([])
      setTimeout(() => {
        if (hasPinnedUser) {
          scrollToTop('smooth')
          return
        }
        nonPinnedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    }

    const list = (
      <div className="min-h-screen">
        {pinnedAggregations.map((agg) => (
          <UserAggregationItem
            key={agg.pubkey}
            feedId={feedId}
            aggregation={agg}
            onClick={() => handleViewUser(agg)}
            isNew={newEventPubkeys.has(agg.pubkey)}
          />
        ))}

        <div ref={nonPinnedTopRef} className="scroll-mt-[calc(6rem+1px)]" />
        {normalAggregations.map((agg) => (
          <UserAggregationItem
            key={agg.pubkey}
            feedId={feedId}
            aggregation={agg}
            onClick={() => handleViewUser(agg)}
            isNew={newEventPubkeys.has(agg.pubkey)}
          />
        ))}

        {loading || hasMoreToDisplay ? (
          <div ref={bottomRef}>
            <UserAggregationItemSkeleton />
          </div>
        ) : aggregations.length === 0 ? (
          <div className="mt-2 flex w-full justify-center">
            <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
              {t('Reload')}
            </Button>
          </div>
        ) : (
          <div className="mt-2 text-center text-sm text-muted-foreground">{t('no more notes')}</div>
        )}
      </div>
    )

    return (
      <div>
        <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
        {showLoadingBar && <LoadingBar />}
        <div className="flex h-12 items-center justify-between gap-2 border-b pl-4 pr-1">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {lastXDays === 1
                ? t('Last 24 hours')
                : t('Last {{count}} days', { count: lastXDays })}
            </span>
            ·
            <span>
              {filteredEvents.length} {t('notes')}
            </span>
          </div>
          <Button
            variant="ghost"
            className="h-10 shrink-0 rounded-lg px-3 text-muted-foreground hover:text-foreground"
            disabled={showLoadingBar || !hasMore}
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
        <div className="h-20" />
        {filteredNewEvents.length > 0 && (
          <NewNotesButton newEvents={filteredNewEvents} onClick={showNewEvents} />
        )}
      </div>
    )
  }
)
UserAggregationList.displayName = 'UserAggregationList'
export default UserAggregationList

function UserAggregationItem({
  feedId,
  aggregation,
  onClick,
  isNew
}: {
  feedId: string
  aggregation: TUserAggregation
  onClick: () => void
  isNew?: boolean
}) {
  const { t } = useTranslation()
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [hasNewEvents, setHasNewEvents] = useState(true)
  const [loading, setLoading] = useState(false)
  const { isPinned, togglePin } = usePinnedUsers()
  const pinned = useMemo(() => isPinned(aggregation.pubkey), [aggregation.pubkey, isPinned])

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
    setLoading(true)
    togglePin(aggregation.pubkey).finally(() => {
      setLoading(false)
    })
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
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 border-b px-4 py-3 transition-all duration-200 hover:bg-accent/30',
        isNew && 'bg-primary/15 hover:bg-primary/20'
      )}
      onClick={onClick}
    >
      {supportTouch ? (
        <SimpleUserAvatar
          userId={aggregation.pubkey}
          className={!hasNewEvents ? 'grayscale' : ''}
        />
      ) : (
        <UserAvatar userId={aggregation.pubkey} className={!hasNewEvents ? 'grayscale' : ''} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          {supportTouch ? (
            <SimpleUsername
              userId={aggregation.pubkey}
              className={cn(
                'max-w-fit truncate text-base font-semibold',
                !hasNewEvents && 'text-muted-foreground'
              )}
              skeletonClassName="h-4"
            />
          ) : (
            <Username
              userId={aggregation.pubkey}
              className={cn(
                'max-w-fit truncate text-base font-semibold',
                !hasNewEvents && 'text-muted-foreground'
              )}
              skeletonClassName="h-4"
            />
          )}
          <TrustScoreBadge pubkey={aggregation.pubkey} />
        </div>
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
          pinned
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title={pinned ? t('Unfollow Special') : t('Special Follow')}
      >
        {loading ? (
          <Loader className="animate-spin" />
        ) : (
          <Star className={pinned ? 'fill-primary stroke-primary' : ''} />
        )}
      </Button>

      <button
        className={cn(
          'flex size-10 flex-shrink-0 flex-col items-center justify-center rounded-full border border-primary/80 bg-primary/10 font-bold tabular-nums text-primary transition-colors hover:border-primary hover:bg-primary/20',
          !hasNewEvents &&
            'border-muted-foreground/80 bg-muted-foreground/10 text-muted-foreground/80 hover:border-muted-foreground hover:bg-muted-foreground/20 hover:text-muted-foreground'
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
        <Skeleton className="my-1 h-4 w-36" />
        <Skeleton className="my-1 h-3 w-14" />
      </div>
      <Skeleton className="size-10 rounded-full" />
    </div>
  )
}
