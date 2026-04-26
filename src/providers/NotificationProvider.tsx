import { useDmUnread } from '@/hooks/useDmUnread'
import { useNotificationFilter } from '@/hooks/useNotificationFilter'
import { usePrimaryPage } from '@/PageManager'
import notificationService from '@/services/notification.service'
import storage from '@/services/local-storage.service'
import { NostrEvent } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNostr } from './NostrProvider'

type TNotificationContext = {
  hasNewNotification: boolean
  getNotificationsSeenAt: () => number
  isNotificationRead: (id: string) => boolean
  markNotificationAsRead: (id: string) => void
}

const NotificationContext = createContext<TNotificationContext | undefined>(undefined)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { current } = usePrimaryPage()
  const active = useMemo(() => current === 'notifications', [current])
  const { pubkey, notificationsSeenAt, updateNotificationsSeenAt } = useNostr()
  const filterFn = useNotificationFilter()
  const [readNotificationIdSet, setReadNotificationIdSet] = useState<Set<string>>(new Set())
  const [filteredNewNotifications, setFilteredNewNotifications] = useState<NostrEvent[]>([])
  const { unreadCount: dmUnreadCount } = useDmUnread()

  useEffect(() => {
    if (!pubkey) {
      notificationService.stop()
      setReadNotificationIdSet(new Set())
      return
    }
    notificationService.start(pubkey)
    setReadNotificationIdSet(new Set())
    return () => {
      // keep the subscription alive for the session; only stop on logout (handled above)
    }
  }, [pubkey])

  useEffect(() => {
    updateNotificationsSeenAt(!active)
  }, [active])

  useEffect(() => {
    if (active || notificationsSeenAt < 0 || !pubkey) {
      setFilteredNewNotifications([])
      return
    }

    let cancelled = false
    const recompute = async () => {
      const events = notificationService.getEvents()
      const filtered: NostrEvent[] = []
      await Promise.allSettled(
        events.map(async (notification) => {
          if (notification.created_at <= notificationsSeenAt || filtered.length >= 10) {
            return
          }
          if (!(await filterFn(notification))) {
            return
          }
          filtered.push(notification)
        })
      )
      if (!cancelled) {
        setFilteredNewNotifications(filtered)
      }
    }

    recompute()
    const unsub = notificationService.onDataChanged(recompute)
    return () => {
      cancelled = true
      unsub()
    }
  }, [active, notificationsSeenAt, pubkey, filterFn])

  useEffect(() => {
    const totalBadgeCount = filteredNewNotifications.length + dmUnreadCount

    // Update title
    if (totalBadgeCount > 0) {
      document.title = `(${totalBadgeCount >= 10 ? '9+' : totalBadgeCount}) Jumble`
    } else {
      document.title = 'Jumble'
    }

    // Update favicons
    const favicons = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")
    if (!favicons.length) return

    if (totalBadgeCount === 0) {
      favicons.forEach((favicon) => {
        favicon.href = '/favicon.ico'
      })
    } else {
      const img = document.createElement('img')
      img.src = '/favicon.ico'
      img.onload = () => {
        const size = Math.max(img.width, img.height, 32)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const r = size * 0.16
        ctx.beginPath()
        ctx.arc(size - r - 6, r + 6, r, 0, 2 * Math.PI)
        ctx.fillStyle = '#FF0000'
        ctx.fill()
        favicons.forEach((favicon) => {
          favicon.href = canvas.toDataURL('image/png')
        })
      }
    }
  }, [filteredNewNotifications, dmUnreadCount])

  const getNotificationsSeenAt = useCallback(() => {
    if (notificationsSeenAt >= 0) {
      return notificationsSeenAt
    }
    if (pubkey) {
      return storage.getLastReadNotificationTime(pubkey)
    }
    return 0
  }, [notificationsSeenAt, pubkey])

  const isNotificationRead = useCallback(
    (notificationId: string): boolean => {
      return readNotificationIdSet.has(notificationId)
    },
    [readNotificationIdSet]
  )

  const markNotificationAsRead = useCallback((notificationId: string): void => {
    setReadNotificationIdSet((prev) => new Set([...prev, notificationId]))
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        hasNewNotification: filteredNewNotifications.length > 0,
        getNotificationsSeenAt,
        isNotificationRead,
        markNotificationAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
