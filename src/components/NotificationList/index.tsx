import { ExtendedKind, NOTIFICATION_LIST_STYLE, SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useInfiniteScroll } from '@/hooks'
import { useNotificationFilter } from '@/hooks/useNotificationFilter'
import { isTouchDevice } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import notificationService from '@/services/notification.service'
import { TNotificationType } from '@/types'
import { NostrEvent, kinds } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { LoadingBar } from '../LoadingBar'
import { RefreshButton } from '../RefreshButton'
import Tabs from '../Tabs'
import TrustScoreFilter from '../TrustScoreFilter'
import { NotificationItem } from './NotificationItem'
import { NotificationSkeleton } from './NotificationItem/Notification'

const SHOW_COUNT = 30
const LOAD_MORE_LIMIT = 100

export default function NotificationList() {
  const { t } = useTranslation()
  const { current } = usePrimaryPage()
  const { pubkey } = useNostr()
  const { getNotificationsSeenAt } = useNotification()
  const { notificationListStyle } = useUserPreferences()
  const filterFn = useNotificationFilter()
  const [notificationType, setNotificationType] = useState<TNotificationType>('all')
  const [lastReadTime, setLastReadTime] = useState(0)
  const [filteredEvents, setFilteredEvents] = useState<NostrEvent[]>([])
  const [initialLoading, setInitialLoading] = useState(notificationService.getInitialLoading())
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const topRef = useRef<HTMLDivElement | null>(null)
  const filterKinds = useMemo(() => {
    switch (notificationType) {
      case 'mentions':
        return new Set<number>([
          kinds.ShortTextNote,
          kinds.Highlights,
          ExtendedKind.COMMENT,
          ExtendedKind.VOICE_COMMENT,
          ExtendedKind.POLL
        ])
      case 'reactions':
        return new Set<number>([
          kinds.Reaction,
          kinds.Repost,
          kinds.GenericRepost,
          ExtendedKind.POLL_RESPONSE
        ])
      case 'zaps':
        return new Set<number>([kinds.Zap])
      default:
        return null
    }
  }, [notificationType])

  // Reset last-read marker whenever this page becomes current.
  useEffect(() => {
    if (current !== 'notifications' || !pubkey) return
    setLastReadTime(getNotificationsSeenAt())
  }, [current, pubkey, getNotificationsSeenAt])

  // Track service loading state.
  useEffect(() => {
    setInitialLoading(notificationService.getInitialLoading())
    const unsub = notificationService.onLoadingChanged(setInitialLoading)
    return unsub
  }, [])

  // Recompute filtered events whenever the underlying data or filter inputs change.
  useEffect(() => {
    if (!pubkey) {
      setFilteredEvents([])
      return
    }

    let cancelled = false
    const cache = new Map<string, boolean>()

    const recompute = async () => {
      const events = notificationService.getEvents()
      const seenIds = new Set<string>()
      const passed: NostrEvent[] = []
      for (const evt of events) {
        if (seenIds.has(evt.id)) continue
        seenIds.add(evt.id)
        let ok = cache.get(evt.id)
        if (ok === undefined) {
          ok = await filterFn(evt)
          if (cancelled) return
          cache.set(evt.id, ok)
        }
        if (ok) passed.push(evt)
      }
      if (!cancelled) {
        setFilteredEvents(passed)
      }
    }

    recompute()
    const unsub = notificationService.onDataChanged(recompute)
    return () => {
      cancelled = true
      unsub()
    }
  }, [pubkey, filterFn])

  const handleLoadMore = useCallback(async () => {
    return notificationService.loadMore(LOAD_MORE_LIMIT)
  }, [])

  const notifications = useMemo(() => {
    if (!filterKinds) return filteredEvents
    return filteredEvents.filter((evt) => filterKinds.has(evt.kind))
  }, [filteredEvents, filterKinds])

  const { visibleItems, shouldShowLoadingIndicator, bottomRef, setShowCount } = useInfiniteScroll({
    items: notifications,
    showCount: SHOW_COUNT,
    onLoadMore: handleLoadMore,
    initialLoading
  })

  const refresh = () => {
    topRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
    setTimeout(() => {
      notificationService.restart()
    }, 500)
  }

  const list = (
    <div>
      {initialLoading && shouldShowLoadingIndicator && <LoadingBar />}
      <div className={notificationListStyle === NOTIFICATION_LIST_STYLE.COMPACT ? 'mb-2' : ''} />
      {visibleItems.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          isNew={notification.created_at > lastReadTime}
        />
      ))}
      <div ref={bottomRef} />
      <div className="text-muted-foreground text-center text-sm">
        {notificationService.hasMore() || shouldShowLoadingIndicator ? (
          <NotificationSkeleton />
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
        options={
          <>
            {!supportTouch ? <RefreshButton onClick={() => refresh()} /> : null}
            <TrustScoreFilter filterId={SPECIAL_TRUST_SCORE_FILTER_ID.NOTIFICATIONS} />
          </>
        }
      />
      <div ref={topRef} className="scroll-mt-24.25" />
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
}
