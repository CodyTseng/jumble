import { Skeleton } from '@/components/ui/skeleton'
import { BIG_RELAY_URLS, COMMENT_EVENT_KIND } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { NotificationItem } from './NotificationItem'

const LIMIT = 100
const SHOW_COUNT = 30

const NotificationList = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { updateNoteStatsByEvents } = useNoteStats()
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(true)
  const [notifications, setNotifications] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [until, setUntil] = useState<number | undefined>(dayjs().unix())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        if (refreshing) return
        setRefreshCount((count) => count + 1)
      }
    }),
    [refreshing]
  )

  useEffect(() => {
    if (!pubkey) {
      setUntil(undefined)
      return
    }

    const init = async () => {
      setRefreshing(true)
      const relayList = await client.fetchRelayList(pubkey)
      let eventCount = 0
      const { closer, timelineKey } = await client.subscribeTimeline(
        relayList.read.length >= 4
          ? relayList.read
          : relayList.read.concat(BIG_RELAY_URLS).slice(0, 4),
        {
          '#p': [pubkey],
          kinds: [kinds.ShortTextNote, kinds.Repost, kinds.Reaction, kinds.Zap, COMMENT_EVENT_KIND],
          limit: LIMIT
        },
        {
          onEvents: (events, eosed) => {
            if (eventCount > events.length) return
            eventCount = events.length
            setNotifications(events.filter((event) => event.pubkey !== pubkey))
            if (eosed) {
              setRefreshing(false)
              setUntil(events.length > 0 ? events[events.length - 1].created_at - 1 : undefined)
              updateNoteStatsByEvents(events)
            }
          },
          onNew: (event) => {
            if (event.pubkey === pubkey) return
            setNotifications((oldEvents) => {
              const index = oldEvents.findIndex(
                (oldEvent) => oldEvent.created_at < event.created_at
              )
              if (index === -1) {
                return [...oldEvents, event]
              }
              return [...oldEvents.slice(0, index), event, ...oldEvents.slice(index)]
            })
            updateNoteStatsByEvents([event])
          }
        }
      )
      setTimelineKey(timelineKey)
      return closer
    }

    const promise = init()
    return () => {
      promise.then((closer) => closer?.())
    }
  }, [pubkey, refreshCount])

  const loadMore = useCallback(async () => {
    if (showCount < notifications.length) {
      setShowCount((count) => count + SHOW_COUNT)
      return
    }

    if (!pubkey || !timelineKey || !until || refreshing) return

    const newNotifications = await client.loadMoreTimeline(timelineKey, until, LIMIT)
    if (newNotifications.length === 0) {
      setUntil(undefined)
      return
    }

    if (newNotifications.length > 0) {
      setNotifications((oldNotifications) => [
        ...oldNotifications,
        ...newNotifications.filter((event) => event.pubkey !== pubkey)
      ])
    }

    setUntil(newNotifications[newNotifications.length - 1].created_at - 1)
  }, [pubkey, timelineKey, until, refreshing, showCount, notifications])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
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

  return (
    <PullToRefresh
      onRefresh={async () => {
        setRefreshCount((count) => count + 1)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }}
      pullingContent=""
    >
      <div>
        {notifications.slice(0, showCount).map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
        <div className="text-center text-sm text-muted-foreground">
          {until || refreshing ? (
            <div ref={bottomRef}>
              <div className="flex gap-2 items-center h-11 py-2">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="h-6 flex-1 w-0" />
              </div>
            </div>
          ) : (
            t('no more notifications')
          )}
        </div>
      </div>
    </PullToRefresh>
  )
})
NotificationList.displayName = 'NotificationList'
export default NotificationList
