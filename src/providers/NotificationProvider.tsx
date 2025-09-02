import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { isMentioningMutedUsers } from '@/lib/event'
import client from '@/services/client.service'
import { kinds } from 'nostr-tools'
import { SubCloser } from 'nostr-tools/abstract-pool'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useContentPolicy } from './ContentPolicyProvider'
import { useMuteList } from './MuteListProvider'
import { useNostr } from './NostrProvider'
import { useUserTrust } from './UserTrustProvider'

type TNotificationContext = {
  hasNewNotification: boolean
  getNotificationsSeenAt: () => number
  clearNewNotifications: () => Promise<void>
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
  const { pubkey, notificationsSeenAt, updateNotificationsSeenAt } = useNostr()
  const { hideUntrustedNotifications, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [newNotificationIds, setNewNotificationIds] = useState(new Set<string>())
  const subCloserRef = useRef<SubCloser | null>(null)

  useEffect(() => {
    if (!pubkey || notificationsSeenAt < 0) return

    setNewNotificationIds(new Set())

    // Track if component is mounted
    const isMountedRef = { current: true }

    const subscribe = async () => {
      if (!isMountedRef.current) return null

      try {
        const relayList = await client.fetchRelayList(pubkey)
        const relayUrls = relayList.read.concat(BIG_RELAY_URLS).slice(0, 4)
        const subCloser = client.subscribe(
          relayUrls,
          [
            {
              kinds: [
                kinds.ShortTextNote,
                kinds.Reaction,
                kinds.Repost,
                kinds.Zap,
                ExtendedKind.COMMENT,
                ExtendedKind.POLL_RESPONSE,
                ExtendedKind.VOICE_COMMENT
              ],
              '#p': [pubkey],
              since: notificationsSeenAt,
              limit: 20
            }
          ],
          {
            onevent: (evt) => {
              // Only show notification if not from self and not muted
              if (
                evt.pubkey !== pubkey &&
                !mutePubkeySet.has(evt.pubkey) &&
                (!hideContentMentioningMutedUsers || !isMentioningMutedUsers(evt, mutePubkeySet)) &&
                (!hideUntrustedNotifications || isUserTrusted(evt.pubkey))
              ) {
                setNewNotificationIds((prev) => {
                  if (prev.has(evt.id)) {
                    return prev
                  }
                  return new Set([...prev, evt.id])
                })
              }
            },
            onclose: (reasons) => {
              if (reasons.every((reason) => reason === 'closed by caller')) {
                return
              }

              // Only reconnect if still mounted and not a manual close
              if (isMountedRef.current && subCloserRef.current) {
                setTimeout(() => {
                  if (isMountedRef.current) {
                    subscribe()
                  }
                }, 5_000)
              }
            }
          }
        )

        subCloserRef.current = subCloser
        return subCloser
      } catch (error) {
        console.error('Subscription error:', error)

        // Retry on error if still mounted
        if (isMountedRef.current) {
          setTimeout(() => {
            if (isMountedRef.current) {
              subscribe()
            }
          }, 5_000)
        }
        return null
      }
    }

    // Initial subscription
    subscribe()

    // Cleanup function
    return () => {
      isMountedRef.current = false
      if (subCloserRef.current) {
        subCloserRef.current.close()
        subCloserRef.current = null
      }
    }
  }, [notificationsSeenAt, pubkey])

  useEffect(() => {
    if (newNotificationIds.size >= 10 && subCloserRef.current) {
      subCloserRef.current.close()
      subCloserRef.current = null
    }
  }, [newNotificationIds])

  useEffect(() => {
    const newNotificationCount = newNotificationIds.size

    // Update title
    if (newNotificationCount > 0) {
      document.title = `(${newNotificationCount >= 10 ? '9+' : newNotificationCount}) Jumble`
    } else {
      document.title = 'Jumble'
    }

    // Update favicons
    const favicons = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")
    if (!favicons.length) return

    if (newNotificationCount === 0) {
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
  }, [newNotificationIds])

  const getNotificationsSeenAt = () => {
    return notificationsSeenAt
  }

  const clearNewNotifications = async () => {
    if (!pubkey) return

    if (subCloserRef.current) {
      subCloserRef.current.close()
      subCloserRef.current = null
    }

    setNewNotificationIds(new Set())
    await updateNotificationsSeenAt()
  }

  return (
    <NotificationContext.Provider
      value={{
        hasNewNotification: newNotificationIds.size > 0,
        clearNewNotifications,
        getNotificationsSeenAt
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
