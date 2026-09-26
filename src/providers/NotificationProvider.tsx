import { useDmUnread } from '@/hooks/useDmUnread'
import { useNotificationFilter } from '@/hooks/useNotificationFilter'
import { getEventAuthorPubkey } from '@/lib/event'
import { toDmConversation } from '@/lib/link'
import { getNotificationFilterType } from '@/lib/notification'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import client from '@/services/client.service'
import dmService from '@/services/dm.service'
import notificationService from '@/services/notification.service'
import storage from '@/services/local-storage.service'
import systemNotification from '@/services/system-notification'
import { TNotificationFilter } from '@/types'
import { TFunction } from 'i18next'
import { NostrEvent } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNostr } from './NostrProvider'
import { useUserPreferences } from './UserPreferencesProvider'

type TNotificationContext = {
  hasNewNotification: boolean
  getNotificationsSeenAt: () => number
  isNotificationRead: (id: string) => boolean
  markNotificationAsRead: (id: string) => void
}

const NotificationContext = createContext<TNotificationContext | undefined>(undefined)
const SYSTEM_NOTIFICATION_TARGET = '/?page=notifications'

function isAppInForeground(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

function getSystemNotificationDescription(type: TNotificationFilter, t: TFunction): string {
  switch (type) {
    case 'likes':
      return t('reacted to your note')
    case 'reposts':
      return t('reposted your note')
    case 'zaps':
      return t('zapped you')
    case 'highlights':
      return t('highlighted your note')
    case 'pollResponses':
      return t('voted in your poll')
    case 'mentions':
      return t('mentioned you in a note')
    case 'replies':
      return t('replied to your note')
    case 'quotes':
      return t('quoted your note')
  }
}

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { current, navigate } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const active = useMemo(() => current === 'notifications', [current])
  const { pubkey, notificationsSeenAt, updateNotificationsSeenAt } = useNostr()
  const { notificationTabs } = useUserPreferences()
  const filterFn = useNotificationFilter()
  const unreadNotificationFilter = useMemo(() => {
    const firstVisibleTab = notificationTabs.find((tab) => !tab.hidden)
    return new Set(firstVisibleTab?.filters ?? [])
  }, [notificationTabs])
  const [readNotificationIdSet, setReadNotificationIdSet] = useState<Set<string>>(new Set())
  const [filteredNewNotifications, setFilteredNewNotifications] = useState<NostrEvent[]>([])
  const { unreadCount: dmUnreadCount, shouldIncludeConversation } = useDmUnread()
  const wasActiveRef = useRef(false)
  const notifiedDmMessageIdsRef = useRef(new Set<string>())

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

  useEffect(
    () =>
      systemNotification.onClick((target) => {
        if (target === SYSTEM_NOTIFICATION_TARGET) {
          navigate('notifications')
        } else if (target?.startsWith('/dms/')) {
          navigate('dms')
          push(target)
        }
      }),
    [navigate, push]
  )

  useEffect(() => {
    notifiedDmMessageIdsRef.current.clear()
  }, [pubkey])

  useEffect(() => {
    let cancelled = false
    const unsubscribe = dmService.onNewMessage((message) => {
      const dispatch = async () => {
        if (!pubkey || message.senderPubkey === pubkey) return

        const notifiedIds = notifiedDmMessageIdsRef.current
        if (notifiedIds.has(message.id)) return
        notifiedIds.add(message.id)
        if (notifiedIds.size > 1_000) {
          const oldestId = notifiedIds.values().next().value
          if (oldestId) notifiedIds.delete(oldestId)
        }

        if (
          !storage.getSystemNotificationsEnabled() ||
          !storage.getSystemDmNotificationsEnabled() ||
          isAppInForeground()
        ) {
          return
        }

        const conversation = await dmService.getConversation(pubkey, message.senderPubkey)
        if (cancelled || !conversation) return
        if (!(await shouldIncludeConversation(conversation)) || cancelled) return

        const profile = await client.fetchProfile(message.senderPubkey)
        if (
          cancelled ||
          !storage.getSystemNotificationsEnabled() ||
          !storage.getSystemDmNotificationsEnabled() ||
          isAppInForeground()
        ) {
          return
        }

        await systemNotification.show({
          id: `dm-${message.id}`,
          title: 'Jumble',
          body: `${profile?.username ?? message.senderPubkey.slice(0, 8)} ${t('sent you a private message')}`,
          target: toDmConversation(message.senderPubkey)
        })
      }
      void dispatch().catch(() => undefined)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [pubkey, shouldIncludeConversation, t])

  useEffect(() => {
    let cancelled = false

    const unsubscribe = notificationService.onNewEvent((event) => {
      const dispatch = async () => {
        if (
          !storage.getSystemNotificationsEnabled() ||
          !storage.getSystemGeneralNotificationsEnabled() ||
          isAppInForeground()
        ) {
          return
        }
        if (!(await filterFn(event)) || cancelled) return

        const type = getNotificationFilterType(event, pubkey)
        if (!type || !unreadNotificationFilter.has(type)) return

        const author = getEventAuthorPubkey(event)
        const profile = await client.fetchProfile(author)
        if (
          cancelled ||
          !storage.getSystemNotificationsEnabled() ||
          !storage.getSystemGeneralNotificationsEnabled() ||
          isAppInForeground()
        ) {
          return
        }

        await systemNotification.show({
          id: event.id,
          title: 'Jumble',
          body: `${profile?.username ?? author.slice(0, 8)} ${getSystemNotificationDescription(type, t)}`,
          target: SYSTEM_NOTIFICATION_TARGET
        })
      }
      void dispatch().catch(() => undefined)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [pubkey, filterFn, unreadNotificationFilter, t])

  useEffect(() => {
    if (active) {
      if (wasActiveRef.current) return
      wasActiveRef.current = true
      // Update the global seen-at on entry so closing the tab while still
      // on this page doesn't lose the read state. The page snapshots its
      // own lastReadTime before this fires, so the in-view bold styling is
      // unaffected.
      updateNotificationsSeenAt()
      return
    }
    if (wasActiveRef.current) {
      wasActiveRef.current = false
      // Re-update on leave so notifications that arrived during the visit
      // aren't shown as "new" again on the next visit.
      updateNotificationsSeenAt()
      setReadNotificationIdSet(new Set())
    }
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
          const notificationType = getNotificationFilterType(notification, pubkey)
          if (notificationType === null || !unreadNotificationFilter.has(notificationType)) {
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
  }, [active, notificationsSeenAt, pubkey, filterFn, unreadNotificationFilter])

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
