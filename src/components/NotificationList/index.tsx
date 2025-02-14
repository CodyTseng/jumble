import { Skeleton } from '@/components/ui/skeleton'
import { COMMENT_EVENT_KIND, PICTURE_EVENT_KIND } from '@/constants'
import { useFetchEvent } from '@/hooks'
import { extractEmbeddedNotesFromContent, extractImagesFromContent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Heart, MessageCircle, Repeat, ThumbsUp } from 'lucide-react'
import { Event, kinds, nip19, validateEvent } from 'nostr-tools'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { embedded, embeddedNostrNpubRenderer, embeddedNostrProfileRenderer } from '../Embedded'
import { FormattedTimestamp } from '../FormattedTimestamp'
import UserAvatar from '../UserAvatar'

const LIMIT = 100
const SHOW_COUNT = 30

const NotificationList = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(true)
  const [notifications, setNotifications] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [until, setUntil] = useState<number | undefined>(dayjs().unix())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        if (refreshing) return
        setRefreshCount((count) => count + 1)
      }
    }),
    [refreshing]
  )

  useEffect(() => {
    if (!pubkey) {
      setUntil(undefined)
      return
    }

    const init = async () => {
      setRefreshing(true)
      const relayList = await client.fetchRelayList(pubkey)
      let eventCount = 0
      const { closer, timelineKey } = await client.subscribeTimeline(
        relayList.read.length >= 4
          ? relayList.read
          : relayList.read.concat(client.getDefaultRelayUrls()).slice(0, 4),
        {
          '#p': [pubkey],
          kinds: [kinds.ShortTextNote, kinds.Repost, kinds.Reaction, COMMENT_EVENT_KIND],
          limit: LIMIT
        },
        {
          onEvents: (events, eosed) => {
            if (eventCount > events.length) return
            eventCount = events.length
            setNotifications(events.filter((event) => event.pubkey !== pubkey))
            if (eosed) {
              setRefreshing(false)
              setUntil(events.length >= 0 ? events[events.length - 1].created_at - 1 : undefined)
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

  const loadMore = useCallback(async () => {
    if (showCount < notifications.length) {
      setShowCount((count) => count + SHOW_COUNT)
      return
    }

    if (!pubkey || !timelineKey || !until || refreshing) return

    const newNotifications = await client.loadMoreTimeline(timelineKey, until, LIMIT)
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
  }, [pubkey, timelineKey, until, refreshing, showCount, notifications])

  useEffect(() => {
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
  }, [loadMore])

  return (
    <PullToRefresh
      onRefresh={async () => {
        setRefreshCount((count) => count + 1)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }}
      pullingContent=""
    >
      <div>
        {notifications.slice(0, showCount).map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
        <div className="text-center text-sm text-muted-foreground">
          {until || refreshing ? (
            <div ref={bottomRef}>
              <div className="flex gap-2 items-center h-11 py-2">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-6 flex-1 w-0" />
              </div>
            </div>
          ) : (
            t('no more notifications')
          )}
        </div>
      </div>
    </PullToRefresh>
  )
})
NotificationList.displayName = 'NotificationList'
export default NotificationList

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
  if (notification.kind === COMMENT_EVENT_KIND) {
    return <CommentNotification notification={notification} />
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
  if (!event || !bech32Id || ![kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(event.kind)) {
    return null
  }

  return (
    <div
      className="flex items-center justify-between cursor-pointer py-2"
      onClick={() => push(toNote(bech32Id))}
    >
      <div className="flex gap-2 items-center flex-1">
        <UserAvatar userId={notification.pubkey} size="small" />
        <Heart size={24} className="text-red-400" />
        <div>{notification.content === '+' ? <ThumbsUp size={14} /> : notification.content}</div>
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

function CommentNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  const rootEventId = notification.tags.find(tagNameEquals('E'))?.[1]
  const rootPubkey = notification.tags.find(tagNameEquals('P'))?.[1]
  const rootKind = notification.tags.find(tagNameEquals('K'))?.[1]
  if (
    !rootEventId ||
    !rootPubkey ||
    !rootKind ||
    ![kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(parseInt(rootKind))
  ) {
    return null
  }

  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => push(toNote({ id: rootEventId, pubkey: rootPubkey }))}
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

function ContentPreview({ event }: { event?: Event }) {
  const { t } = useTranslation()
  const content = useMemo(() => {
    if (!event) return null
    const { contentWithoutEmbeddedNotes } = extractEmbeddedNotesFromContent(event.content)
    const { contentWithoutImages, images } = extractImagesFromContent(contentWithoutEmbeddedNotes)
    return embedded(contentWithoutImages + (images?.length ? `[${t('image')}]` : ''), [
      embeddedNostrProfileRenderer,
      embeddedNostrNpubRenderer
    ])
  }, [event])
  if (!event) return null

  return <div className="truncate flex-1 w-0">{content}</div>
}
