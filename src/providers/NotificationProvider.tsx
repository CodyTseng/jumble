import { BIG_RELAY_URLS, COMMENT_EVENT_KIND } from '@/constants'
import { TPrimaryPageName, usePrimaryPage } from '@/PageManager'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import dayjs from 'dayjs'
import { kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
  const { current } = usePrimaryPage()
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [lastReadTime, setLastReadTime] = useState(0)
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
    if (!pubkey || current === 'notifications') return

    const init = async () => {
      const relayList = await client.fetchRelayList(pubkey)
      const relayUrls = relayList.read.concat(BIG_RELAY_URLS).slice(0, 4)
      const subCloser = client.subscribe(
        relayUrls,
        [
          {
            kinds: [
              kinds.ShortTextNote,
              COMMENT_EVENT_KIND,
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
            if (evt.pubkey !== pubkey) {
              setHasNewNotification(true)
              subCloser.close()
            }
          }
        }
      )
      return subCloser
    }
    const promise = init()
    return () => {
      promise.then((subCloser) => subCloser.close())
    }
  }, [lastReadTime, current, pubkey])

  useEffect(() => {
    if (!pubkey || lastReadTime === 0) return
    storage.setLastReadNotificationTime(pubkey, lastReadTime)
  }, [lastReadTime])

  useEffect(() => {
    if (!pubkey) return
    setLastReadTime(storage.getLastReadNotificationTime(pubkey))
    setHasNewNotification(false)
  }, [pubkey])

  return (
    <NotificationContext.Provider value={{ hasNewNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}
