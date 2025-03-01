import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { BIG_RELAY_URLS, COMMENT_EVENT_KIND } from '@/constants'
import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { TNotificationType } from '@/types'
import dayjs from 'dayjs'
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
import { NotificationItem } from './NotificationItem'

const LIMIT = 100
const SHOW_COUNT = 30

const NotificationList = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { updateNoteStatsByEvents } = useNoteStats()
  const [notificationType, setNotificationType] = useState<TNotificationType>('all')
  const [lastReadTime, setLastReadTime] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(true)
  const [notifications, setNotifications] = useState<Event[]>([])
  const [newNotifications, setNewNotifications] = useState<Event[]>([])
  const [oldNotifications, setOldNotifications] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [until, setUntil] = useState<number | undefined>(dayjs().unix())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const filterKinds = useMemo(() => {
    switch (notificationType) {
      case 'mentions':
        return [kinds.ShortTextNote, COMMENT_EVENT_KIND]
      case 'reactions':
        return [kinds.Reaction, kinds.Repost]
      case 'zaps':
        return [kinds.Zap]
      default:
        return [kinds.ShortTextNote, kinds.Repost, kinds.Reaction, kinds.Zap, COMMENT_EVENT_KIND]
    }
  }, [notificationType])
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
      setNotifications([])
      setShowCount(SHOW_COUNT)
      setLastReadTime(storage.getLastReadNotificationTime(pubkey))
      const relayList = await client.fetchRelayList(pubkey)
      let eventCount = 0
      const { closer, timelineKey } = await client.subscribeTimeline(
        relayList.read.length >= 4
          ? relayList.read
          : relayList.read.concat(BIG_RELAY_URLS).slice(0, 4),
        {
          '#p': [pubkey],
          kinds: filterKinds,
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
  }, [pubkey, refreshCount, filterKinds])

  useEffect(() => {
    const visibleNotifications = notifications.slice(0, showCount)
    const index = visibleNotifications.findIndex((event) => event.created_at <= lastReadTime)
    if (index === -1) {
      setNewNotifications(visibleNotifications)
      setOldNotifications([])
    } else {
      setNewNotifications(visibleNotifications.slice(0, index))
      setOldNotifications(visibleNotifications.slice(index))
    }
  }, [notifications, lastReadTime, showCount])

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
    <div>
      <NotificationTypeSwitch
        type={notificationType}
        setType={(type) => {
          setShowCount(SHOW_COUNT)
          setNotificationType(type)
        }}
      />
      <PullToRefresh
        onRefresh={async () => {
          setRefreshCount((count) => count + 1)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }}
        pullingContent=""
      >
        <div className="px-4 pt-2">
          {newNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} isNew />
          ))}
          {!!newNotifications.length && (
            <div className="relative my-2">
              <Separator />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                {t('Earlier notifications')}
              </span>
            </div>
          )}
          {oldNotifications.map((notification) => (
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
    </div>
  )
})
NotificationList.displayName = 'NotificationList'
export default NotificationList

function NotificationTypeSwitch({
  type,
  setType
}: {
  type: TNotificationType
  setType: (type: TNotificationType) => void
}) {
  const { t } = useTranslation()
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()

  return (
    <div
      className={cn(
        'sticky top-12 bg-background z-30 duration-700 transition-transform select-none',
        deepBrowsing && lastScrollTop > 800 ? '-translate-y-[calc(100%+12rem)]' : ''
      )}
    >
      <div className="flex">
        <div
          className={`w-1/4 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${type === 'all' ? '' : 'text-muted-foreground'}`}
          onClick={() => setType('all')}
        >
          {t('All')}
        </div>
        <div
          className={`w-1/4 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${type === 'mentions' ? '' : 'text-muted-foreground'}`}
          onClick={() => setType('mentions')}
        >
          {t('Mentions')}
        </div>
        <div
          className={`w-1/4 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${type === 'reactions' ? '' : 'text-muted-foreground'}`}
          onClick={() => setType('reactions')}
        >
          {t('Reactions')}
        </div>
        <div
          className={`w-1/4 text-center py-2 font-semibold clickable cursor-pointer rounded-lg ${type === 'zaps' ? '' : 'text-muted-foreground'}`}
          onClick={() => setType('zaps')}
        >
          {t('Zaps')}
        </div>
      </div>
      <div
        className={`w-1/4 px-4 sm:px-6 transition-transform duration-500 ${type === 'mentions' ? 'translate-x-full' : type === 'reactions' ? 'translate-x-[200%]' : type === 'zaps' ? 'translate-x-[300%]' : ''} `}
      >
        <div className="w-full h-1 bg-primary rounded-full" />
      </div>
    </div>
  )
}
