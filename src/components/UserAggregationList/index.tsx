import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { isMentioningMutedUsers } from '@/lib/event'
import { toUserAggregationDetail } from '@/lib/link'
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
import { Event } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LIMIT = 500

export default function UserAggregationList({
  subRequests,
  feedId,
  showKinds,
  filterFn,
  filterMutedNotes = true
}: {
  subRequests: TFeedSubRequest[]
  feedId: string
  showKinds?: number[]
  filterFn?: (event: Event) => boolean
  filterMutedNotes?: boolean
}) {
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
  const [pinnedPubkeys, setPinnedPubkeys] = useState<Set<string>>(
    new Set(userAggregationService.getPinnedPubkeys())
  )
  const [refreshKey, setRefreshKey] = useState(0)

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
              userAggregationService.setCachedEvents(feedId, events)
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
              userAggregationService.setCachedEvents(feedId, newEvents)
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
  }, [JSON.stringify(subRequests), JSON.stringify(showKinds), feedId])

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
      setEvents((oldEvents) => {
        const combinedEvents = [...oldEvents, ...moreEvents]
        userAggregationService.setCachedEvents(feedId, combinedEvents)
        return combinedEvents
      })
      setLoading(false)
    })
  }, [loading, timelineKey, events])

  useEffect(() => {
    const unsubscribe = userAggregationService.subscribe(() => {
      setPinnedPubkeys(new Set(userAggregationService.getPinnedPubkeys()))
      setRefreshKey((prev) => prev + 1)
    })

    return unsubscribe
  }, [])

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

  const aggregations = useMemo(() => {
    let filteredEvents = events

    filteredEvents = filteredEvents.filter((evt) => {
      return !shouldHideEvent(evt)
    })

    const aggs = userAggregationService.aggregateByUser(filteredEvents)
    return userAggregationService.sortWithPinned(aggs)
  }, [events, shouldHideEvent, refreshKey])

  const handleTogglePin = (pubkey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    userAggregationService.togglePin(pubkey)
    setPinnedPubkeys(new Set(userAggregationService.getPinnedPubkeys()))
  }

  const handleViewUser = (agg: TUserAggregation) => {
    push(toUserAggregationDetail(feedId, agg.pubkey))
  }

  return (
    <div>
      {aggregations.map((agg) => (
        <UserAggregationItem
          key={agg.pubkey}
          aggregation={agg}
          isPinned={pinnedPubkeys.has(agg.pubkey)}
          onTogglePin={handleTogglePin}
          onClick={() => handleViewUser(agg)}
        />
      ))}
      {loading && Array.from({ length: 5 }).map((_, i) => <UserAggregationItemSkeleton key={i} />)}
      {!loading && aggregations.length === 0 && (
        <div className="flex justify-center items-center h-40 text-muted-foreground">
          {t('no notes')}
        </div>
      )}
    </div>
  )
}

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
  return (
    <div
      className="flex items-center gap-3 p-4 border-b hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <UserAvatar userId={aggregation.pubkey} className="w-12 h-12" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Username userId={aggregation.pubkey} className="font-semibold truncate" />
          {isPinned && <Pin className="w-4 h-4 text-primary flex-shrink-0" />}
        </div>
        <div className="text-sm text-muted-foreground">
          <FormattedTimestamp timestamp={aggregation.lastEventTime} />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => onTogglePin(aggregation.pubkey, e)}
        className="flex-shrink-0"
      >
        {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
      </Button>

      <div className="flex flex-col items-center justify-center size-12">
        <div className="text-2xl font-bold text-primary">{aggregation.count}</div>
        <div className="text-xs text-muted-foreground">
          {aggregation.count === 1 ? 'post' : 'posts'}
        </div>
      </div>
    </div>
  )
}

function UserAggregationItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="size-12 rounded-md" />
    </div>
  )
}
