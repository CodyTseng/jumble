import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import noteStatsService from '@/services/note-stats.service'
import { TNotificationType } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import Tabs from '../Tabs'
import { NotificationItem } from './NotificationItem'

const LIMIT = 100
const SHOW_COUNT = 30

const NotificationList = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { current } = usePrimaryPage()
  const { pubkey } = useNostr()
  const { hideUntrustedNotifications, isUserTrusted } = useUserTrust()
  const { clearNewNotifications, getNotificationsSeenAt } = useNotification()
  const [notificationType, setNotificationType] = useState<TNotificationType>('all')
  const [lastReadTime, setLastReadTime] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Event[]>([])
  const [newNotifications, setNewNotifications] = useState<Event[]>([])
  const [oldNotifications, setOldNotifications] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [until, setUntil] = useState<number | undefined>(dayjs().unix())
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
      clearNewNotifications()
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
              noteStatsService.updateNoteStatsByEvents(events)
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
            noteStatsService.updateNoteStatsByEvents([event])
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
    let visibleNotifications = notifications.slice(0, showCount)
    if (hideUntrustedNotifications) {
      visibleNotifications = visibleNotifications.filter((event) => isUserTrusted(event.pubkey))
    }

    const index = visibleNotifications.findIndex((event) => event.created_at <= lastReadTime)
    if (index === -1) {
      setNewNotifications(visibleNotifications)
      setOldNotifications([])
    } else {
      setNewNotifications(visibleNotifications.slice(0, index))
      setOldNotifications(visibleNotifications.slice(index))
    }
  }, [notifications, lastReadTime, showCount, hideUntrustedNotifications, isUserTrusted])

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
            {until || loading ? (
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
