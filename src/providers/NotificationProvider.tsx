import { useDmUnread } from '@/hooks/useDmUnread'
import { ExtendedKind, SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { compareEvents } from '@/lib/event'
import { notificationFilter } from '@/lib/notification'
import { getDefaultRelayUrls } from '@/lib/relay'
import { usePrimaryPage } from '@/PageManager'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { kinds, NostrEvent } from 'nostr-tools'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useContentPolicy } from './ContentPolicyProvider'
import { useMuteList } from './MuteListProvider'
import { useNostr } from './NostrProvider'
import { useUserTrust } from './UserTrustProvider'

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
  const { mutePubkeySet } = useMuteList()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [newNotifications, setNewNotifications] = useState<NostrEvent[]>([])
  const [readNotificationIdSet, setReadNotificationIdSet] = useState<Set<string>>(new Set())
  const [filteredNewNotifications, setFilteredNewNotifications] = useState<NostrEvent[]>([])
  const { unreadCount: dmUnreadCount } = useDmUnread()

  useEffect(() => {
    if (active || notificationsSeenAt < 0) {
      setFilteredNewNotifications([])
      return
    }
    const filterNotifications = async () => {
      const filtered: NostrEvent[] = []
      const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.NOTIFICATIONS)
      await Promise.allSettled(
        newNotifications.map(async (notification) => {
          if (notification.created_at <= notificationsSeenAt || filtered.length >= 10) {
            return
          }
          if (
            !(await notificationFilter(notification, {
              pubkey,
              mutePubkeySet,
              hideContentMentioningMutedUsers,
              meetsMinTrustScore: async (pubkey: string) => {
                if (trustScoreThreshold === 0) return true
                return meetsMinTrustScore(pubkey, trustScoreThreshold)
              }
            }))
          ) {
            return
          }
          filtered.push(notification)
        })
      )
      setFilteredNewNotifications(filtered)
    }
    filterNotifications()
  }, [
    newNotifications,
    notificationsSeenAt,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    meetsMinTrustScore
  ])

  useEffect(() => {
    setNewNotifications([])
    updateNotificationsSeenAt(!active)
  }, [active])

  useEffect(() => {
    if (!pubkey) return

    setNewNotifications([])
    setReadNotificationIdSet(new Set())

    const subscribe = async () => {
      let eosed = false
      const relayList = await client.fetchRelayList(pubkey)
      const relays = relayList.read.length > 0 ? relayList.read.slice(0, 5) : getDefaultRelayUrls()
      return client.subscribe(
        relays,
        [
          {
            kinds: [
              kinds.ShortTextNote,
              kinds.Repost,
              kinds.GenericRepost,
              kinds.Reaction,
              kinds.Zap,
              kinds.Highlights,
              ExtendedKind.COMMENT,
              ExtendedKind.POLL_RESPONSE,
              ExtendedKind.VOICE_COMMENT,
              ExtendedKind.POLL
            ],
            '#p': [pubkey],
            limit: 20
          }
        ],
        {
          oneose: (e) => {
            if (e) {
              eosed = e
              setNewNotifications((prev) => {
                return [...prev.sort((a, b) => compareEvents(b, a))]
              })
            }
          },
          onevent: (evt) => {
            if (evt.pubkey !== pubkey) {
              setNewNotifications((prev) => {
                if (!eosed) {
                  return [evt, ...prev]
                }
                if (prev.length && compareEvents(prev[0], evt) >= 0) {
                  return prev
                }

                client.emitNewEvent(evt, relays)
                return [evt, ...prev]
              })
            }
          }
        }
      )
    }

    const promise = subscribe()
    return () => {
      promise.then((closer) => closer.close())
    }
  }, [pubkey])

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

  const getNotificationsSeenAt = () => {
    if (notificationsSeenAt >= 0) {
      return notificationsSeenAt
    }
    if (pubkey) {
      return storage.getLastReadNotificationTime(pubkey)
    }
    return 0
  }

  const isNotificationRead = (notificationId: string): boolean => {
    return readNotificationIdSet.has(notificationId)
  }

  const markNotificationAsRead = (notificationId: string): void => {
    setReadNotificationIdSet((prev) => new Set([...prev, notificationId]))
  }

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
