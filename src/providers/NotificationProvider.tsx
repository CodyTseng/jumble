import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { TPrimaryPageName, usePrimaryPage } from '@/PageManager'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import dayjs from 'dayjs'
import { kinds } from 'nostr-tools'
import { SubCloser } from 'nostr-tools/abstract-pool'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useMuteList } from './MuteListProvider'
import { useNostr } from './NostrProvider'

type TNotificationContext = {
  hasNewNotification: boolean
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
  const { pubkey } = useNostr()
  const { mutePubkeys } = useMuteList()
  const { current } = usePrimaryPage()
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [lastReadTime, setLastReadTime] = useState(-1)
  const previousPageRef = useRef<TPrimaryPageName | null>(null)

  useEffect(() => {
    if (current !== 'notifications' && previousPageRef.current === 'notifications') {
      // navigate from notifications to other pages
      setLastReadTime(dayjs().unix())
      setHasNewNotification(false)
    } else if (current === 'notifications' && previousPageRef.current !== null) {
      // navigate to notifications
      setHasNewNotification(false)
    }
    previousPageRef.current = current
  }, [current])

  useEffect(() => {
    if (!pubkey || lastReadTime < 0) return
    storage.setLastReadNotificationTime(pubkey, lastReadTime)
  }, [lastReadTime])

  useEffect(() => {
    if (!pubkey) return
    setLastReadTime(storage.getLastReadNotificationTime(pubkey))
    setHasNewNotification(false)
  }, [pubkey])

  useEffect(() => {
    if (!pubkey || lastReadTime < 0) return

    // Track if component is mounted
    const isMountedRef = { current: true }
    let currentSubCloser: SubCloser | null = null

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
                ExtendedKind.COMMENT,
                kinds.Reaction,
                kinds.Repost,
                kinds.Zap
              ],
              '#p': [pubkey],
              since: lastReadTime ?? dayjs().unix(),
              limit: 10
            }
          ],
          {
            onevent: (evt) => {
              // Only show notification if not from self and not muted
              if (evt.pubkey !== pubkey && !mutePubkeys.includes(evt.pubkey)) {
                setHasNewNotification(true)
                subCloser.close()
              }
            },
            onclose: (reasons) => {
              if (reasons.every((reason) => reason === 'closed by caller')) {
                return
              }

              // Only reconnect if still mounted and not a manual close
              if (isMountedRef.current && currentSubCloser) {
                setTimeout(() => {
                  if (isMountedRef.current) {
                    subscribe()
                  }
                }, 5000)
              }
            }
          }
        )

        currentSubCloser = subCloser
        return subCloser
      } catch (error) {
        console.error('Subscription error:', error)

        // Retry on error if still mounted
        if (isMountedRef.current) {
          setTimeout(() => {
            if (isMountedRef.current) {
              subscribe()
            }
          }, 5000)
        }
        return null
      }
    }

    // Initial subscription
    subscribe()

    // Cleanup function
    return () => {
      isMountedRef.current = false
      if (currentSubCloser) {
        currentSubCloser.close()
        currentSubCloser = null
      }
    }
  }, [lastReadTime, pubkey])

  return (
    <NotificationContext.Provider value={{ hasNewNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}
