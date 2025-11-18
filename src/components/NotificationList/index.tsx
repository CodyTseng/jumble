import { BIG_RELAY_URLS, ExtendedKind, NOTIFICATION_LIST_STYLE } from '@/constants'
import { compareEvents } from '@/lib/event'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import client from '@/services/client.service'
import stuffStatsService from '@/services/stuff-stats.service'
import { TNotificationType } from '@/types'
import dayjs from 'dayjs'
import { NostrEvent, kinds, matchFilter } from 'nostr-tools'
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
import Tabs from '../Tabs'
import { NotificationItem } from './NotificationItem'
import { NotificationSkeleton } from './NotificationItem/Notification'
import { isTouchDevice } from '@/lib/utils'
import { RefreshButton } from '../RefreshButton'

const LIMIT = 100
const SHOW_COUNT = 30

const NotificationList = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { current, display } = usePrimaryPage()
  const active = useMemo(() => current === 'notifications' && display, [current, display])
  const { pubkey } = useNostr()
  const { getNotificationsSeenAt } = useNotification()
  const { notificationListStyle } = useUserPreferences()
  const [notificationType, setNotificationType] = useState<TNotificationType>('all')
  const [lastReadTime, setLastReadTime] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NostrEvent[]>([])
  const [visibleNotifications, setVisibleNotifications] = useState<NostrEvent[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [until, setUntil] = useState<number | undefined>(dayjs().unix())
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const topRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const filterKinds = useMemo(() => {
    switch (notificationType) {
      case 'mentions':
        return [
          kinds.ShortTextNote,
          ExtendedKind.COMMENT,
          ExtendedKind.VOICE_COMMENT,
          ExtendedKind.POLL
        ]
      case 'reactions':
        return [kinds.Reaction, kinds.Repost, ExtendedKind.POLL_RESPONSE]
      case 'zaps':
        return [kinds.Zap]
      default:
        return [
          kinds.ShortTextNote,
          kinds.Repost,
          kinds.Reaction,
          kinds.Zap,
          ExtendedKind.COMMENT,
          ExtendedKind.POLL_RESPONSE,
          ExtendedKind.VOICE_COMMENT,
          ExtendedKind.POLL
        ]
    }
  }, [notificationType])
  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        if (loading) return
        setRefreshCount((count) => count + 1)
      }
    }),
    [loading]
  )

  const handleNewEvent = useCallback(
    (event: NostrEvent) => {
      if (event.pubkey === pubkey) return
      setNotifications((oldEvents) => {
        const index = oldEvents.findIndex((oldEvent) => compareEvents(oldEvent, event) <= 0)
        if (index !== -1 && oldEvents[index].id === event.id) {
          return oldEvents
        }

        stuffStatsService.updateStuffStatsByEvents([event])
        if (index === -1) {
          return [...oldEvents, event]
        }
        return [...oldEvents.slice(0, index), event, ...oldEvents.slice(index)]
      })
    },
    [pubkey]
  )

  useEffect(() => {
    if (current !== 'notifications') return

    if (!pubkey) {
      setUntil(undefined)
      return
    }

    const init = async () => {
      setLoading(true)
      setNotifications([])
      setShowCount(SHOW_COUNT)
      setLastReadTime(getNotificationsSeenAt())
      const relayList = await client.fetchRelayList(pubkey)

      const { closer, timelineKey } = await client.subscribeTimeline(
        [
          {
            urls: relayList.read.length > 0 ? relayList.read.slice(0, 5) : BIG_RELAY_URLS,
            filter: {
              '#p': [pubkey],
              kinds: filterKinds,
              limit: LIMIT
            }
          }
        ],
        {
          onEvents: (events, eosed) => {
            if (events.length > 0) {
              setNotifications(events.filter((event) => event.pubkey !== pubkey))
            }
            if (eosed) {
              setLoading(false)
              setUntil(events.length > 0 ? events[events.length - 1].created_at - 1 : undefined)
              stuffStatsService.updateStuffStatsByEvents(events)
            }
          },
          onNew: (event) => {
            handleNewEvent(event)
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
  }, [pubkey, refreshCount, filterKinds, current])

  useEffect(() => {
    if (!active || !pubkey) return

    const handler = (data: Event) => {
      const customEvent = data as CustomEvent<NostrEvent>
      const evt = customEvent.detail
      if (
        matchFilter(
          {
            kinds: filterKinds,
            '#p': [pubkey]
          },
          evt
        )
      ) {
        handleNewEvent(evt)
      }
    }

    client.addEventListener('newEvent', handler)
    return () => {
      client.removeEventListener('newEvent', handler)
    }
  }, [pubkey, active, filterKinds, handleNewEvent])

  useEffect(() => {
    setVisibleNotifications(notifications.slice(0, showCount))
  }, [notifications, showCount])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const loadMore = async () => {
      if (showCount < notifications.length) {
        setShowCount((count) => count + SHOW_COUNT)
        // preload more
        if (notifications.length - showCount > LIMIT / 2) {
          return
        }
      }

      if (!pubkey || !timelineKey || !until || loading) return
      setLoading(true)
      const newNotifications = await client.loadMoreTimeline(timelineKey, until, LIMIT)
      setLoading(false)
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
  }, [pubkey, timelineKey, until, loading, showCount, notifications])

  const refresh = () => {
    topRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
    setTimeout(() => {
      setRefreshCount((count) => count + 1)
    }, 500)
  }

  const list = (
    <div className={notificationListStyle === NOTIFICATION_LIST_STYLE.COMPACT ? 'pt-2' : ''}>
      {visibleNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          isNew={notification.created_at > lastReadTime}
        />
      ))}
      <div className="text-center text-sm text-muted-foreground">
        {until || loading ? (
          <div ref={bottomRef}>
            <NotificationSkeleton />
          </div>
        ) : (
          t('no more notifications')
        )}
      </div>
    </div>
  )

  return (
    <div>
      <Tabs
        value={notificationType}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'mentions', label: 'Mentions' },
          { value: 'reactions', label: 'Reactions' },
          { value: 'zaps', label: 'Zaps' }
        ]}
        onTabChange={(type) => {
          setShowCount(SHOW_COUNT)
          setNotificationType(type as TNotificationType)
        }}
        options={!supportTouch ? <RefreshButton onClick={() => refresh()} /> : null}
      />
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
    </div>
  )
})
NotificationList.displayName = 'NotificationList'
export default NotificationList
