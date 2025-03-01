import { BIG_RELAY_URLS, COMMENT_EVENT_KIND } from '@/constants'
import { usePrimaryPage } from '@/PageManager'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import dayjs from 'dayjs'
import { kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNostr } from './NostrProvider'

type TNotificationContext = {
  hasNewNotification: boolean
  updateLastReadTime: () => void
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
  const previousPageRef = useRef(current)

  useEffect(() => {
    if (current !== 'notifications' && previousPageRef.current === 'notifications') {
      updateLastReadTime()
    } else if (current === 'notifications') {
      setHasNewNotification(false)
    }
    previousPageRef.current = current
  }, [current])

  useEffect(() => {
    if (!pubkey || current === 'notifications' || !lastReadTime) return

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
  }, [pubkey])

  const updateLastReadTime = () => {
    setLastReadTime(dayjs().unix())
    setHasNewNotification(false)
  }

  return (
    <NotificationContext.Provider value={{ hasNewNotification, updateLastReadTime }}>
      {children}
    </NotificationContext.Provider>
  )
}
