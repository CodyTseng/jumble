import { useFetchEvent } from '@/hooks'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Heart, MessageCircle, Repeat } from 'lucide-react'
import { Event, kinds, nip19, validateEvent } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormattedTimestamp } from '../FormattedTimestamp'
import UserAvatar from '../UserAvatar'
import PullToRefresh from 'react-simple-pull-to-refresh'

const LIMIT = 50

export default function NotificationList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [refreshCount, setRefreshCount] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [notifications, setNotifications] = useState<Event[]>([])
  const [until, setUntil] = useState<number | undefined>(dayjs().unix())
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!pubkey) {
      setUntil(undefined)
      return
    }

    const init = async () => {
      const relayList = await client.fetchRelayList(pubkey)
      const { closer, timelineKey } = await client.subscribeTimeline(
        relayList.read.length >= 4
          ? relayList.read
          : relayList.read.concat(client.getDefaultRelayUrls()).slice(0, 4),
        {
          '#p': [pubkey],
          kinds: [kinds.ShortTextNote, kinds.Repost, kinds.Reaction],
          limit: LIMIT
        },
        {
          onEvents: (events, eosed) => {
            setNotifications(events.filter((event) => event.pubkey !== pubkey))
            setUntil(events.length >= LIMIT ? events[events.length - 1].created_at - 1 : undefined)
            if (eosed) {
              setInitialized(true)
            }
          },
          onNew: (event) => {
            if (event.pubkey === pubkey) return
            setNotifications((oldEvents) => [event, ...oldEvents])
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
  }, [pubkey, refreshCount])

  useEffect(() => {
    if (!initialized) return

    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
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
  }, [until, initialized, timelineKey])

  const loadMore = async () => {
    if (!pubkey || !timelineKey || !until) return
    const notifications = await client.loadMoreTimeline(timelineKey, until, LIMIT)
    if (notifications.length === 0) {
      setUntil(undefined)
      return
    }

    if (notifications.length > 0) {
      setNotifications((oldNotifications) => [...oldNotifications, ...notifications])
    }

    setUntil(notifications[notifications.length - 1].created_at - 1)
  }

  return (
    <PullToRefresh
      onRefresh={async () =>
        new Promise((resolve) => {
          setRefreshCount((pre) => pre + 1)
          setTimeout(resolve, 1000)
        })
      }
      pullingContent=""
    >
      <div>
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
        <div className="text-center text-sm text-muted-foreground">
          {until ? <div ref={bottomRef}>{t('loading...')}</div> : t('no more notifications')}
        </div>
      </div>
    </PullToRefresh>
  )
}

function NotificationItem({ notification }: { notification: Event }) {
  if (notification.kind === kinds.Reaction) {
    return <ReactionNotification notification={notification} />
  }
  if (notification.kind === kinds.ShortTextNote) {
    return <ReplyNotification notification={notification} />
  }
  if (notification.kind === kinds.Repost) {
    return <RepostNotification notification={notification} />
  }
  return null
}

function ReactionNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  const bech32Id = useMemo(() => {
    const eTag = notification.tags.findLast(tagNameEquals('e'))
    const pTag = notification.tags.find(tagNameEquals('p'))
    const eventId = eTag?.[1]
    const author = pTag?.[1]
    return eventId
      ? nip19.neventEncode(author ? { id: eventId, author } : { id: eventId })
      : undefined
  }, [notification])
  const { event } = useFetchEvent(bech32Id)
  if (!event || !bech32Id || event.kind !== kinds.ShortTextNote) return null

  return (
    <div
      className="flex items-center justify-between cursor-pointer py-2"
      onClick={() => push(toNote(bech32Id))}
    >
      <div className="flex gap-2 items-center flex-1">
        <UserAvatar userId={notification.pubkey} size="small" />
        <Heart size={24} className="text-red-400" />
        <ContentPreview event={event} />
      </div>
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}

function ReplyNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => push(toNote(notification))}
    >
      <UserAvatar userId={notification.pubkey} size="small" />
      <MessageCircle size={24} className="text-blue-400" />
      <ContentPreview event={notification} />
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}

function RepostNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  const event = useMemo(() => {
    try {
      const event = JSON.parse(notification.content) as Event
      const isValid = validateEvent(event)
      if (!isValid) return null
      client.addEventToCache(event)
      return event
    } catch {
      return null
    }
  }, [notification.content])
  if (!event) return null

  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => push(toNote(event))}
    >
      <UserAvatar userId={notification.pubkey} size="small" />
      <Repeat size={24} className="text-green-400" />
      <ContentPreview event={event} />
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}

function ContentPreview({ event }: { event?: Event }) {
  if (!event || event.kind !== kinds.ShortTextNote) return null

  return <div className="truncate flex-1 w-0">{event.content}</div>
}
