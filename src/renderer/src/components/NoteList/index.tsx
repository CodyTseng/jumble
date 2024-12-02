import { Button } from '@renderer/components/ui/button'
import { isReplyNoteEvent } from '@renderer/lib/event'
import { cn } from '@renderer/lib/utils'
import { useNostr } from '@renderer/providers/NostrProvider'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import NoteCard from '../NoteCard'
import { useTranslation } from 'react-i18next'

export default function NoteList({
  relayUrls,
  filter = {},
  className
}: {
  relayUrls: string[]
  filter?: Filter
  className?: string
}) {
  const { t } = useTranslation()
  const { isReady, singEvent } = useNostr()
  const [events, setEvents] = useState<Event[]>([])
  const [newEvents, setNewEvents] = useState<Event[]>([])
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [initialized, setInitialized] = useState(false)
  const observer = useRef<IntersectionObserver | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const noteFilter = useMemo(() => {
    return {
      kinds: [kinds.ShortTextNote, kinds.Repost],
      limit: 200,
      ...filter
    }
  }, [JSON.stringify(filter)])

  useEffect(() => {
    if (!isReady) return

    setInitialized(false)
    setEvents([])
    setNewEvents([])
    setHasMore(true)

    const subCloser = client.subscribeEventsWithAuth(
      relayUrls,
      noteFilter,
      {
        onEose: (events) => {
          const processedEvents = events.filter((e) => !isReplyNoteEvent(e))
          if (processedEvents.length > 0) {
            setEvents((pre) => [...pre, ...processedEvents])
          }
          if (events.length > 0) {
            setUntil(events[events.length - 1].created_at - 1)
          }
          setInitialized(true)
        },
        onNew: (event) => {
          if (!isReplyNoteEvent(event)) {
            setNewEvents((oldEvents) => [event, ...oldEvents])
          }
        }
      },
      singEvent
    )

    return () => {
      subCloser()
    }
  }, [JSON.stringify(relayUrls), JSON.stringify(noteFilter), isReady])

  useEffect(() => {
    if (!initialized) return

    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    }, options)

    if (bottomRef.current) {
      observer.current.observe(bottomRef.current)
    }

    return () => {
      if (observer.current && bottomRef.current) {
        observer.current.unobserve(bottomRef.current)
      }
    }
  }, [until, initialized, hasMore])

  const loadMore = async () => {
    const events = await client.fetchEvents(relayUrls, { ...noteFilter, until }, true)
    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
    if (sortedEvents.length === 0) {
      setHasMore(false)
      return
    }

    const processedEvents = sortedEvents.filter((e) => !isReplyNoteEvent(e))
    if (processedEvents.length > 0) {
      setEvents((oldEvents) => [...oldEvents, ...processedEvents])
    }

    setUntil(sortedEvents[sortedEvents.length - 1].created_at - 1)
  }

  const showNewEvents = () => {
    setEvents((oldEvents) => [...newEvents, ...oldEvents])
    setNewEvents([])
  }

  return (
    <>
      {newEvents.length > 0 && (
        <div className="flex justify-center w-full mb-4">
          <Button size="lg" onClick={showNewEvents}>
            {t('show new notes')}
          </Button>
        </div>
      )}
      <div className={cn('flex flex-col sm:gap-4', className)}>
        {events.map((event, i) => (
          <NoteCard key={`${i}-${event.id}`} className="w-full" event={event} />
        ))}
      </div>
      <div className="text-center text-sm text-muted-foreground mt-2">
        {hasMore ? <div ref={bottomRef}>{t('loading...')}</div> : t('no more notes')}
      </div>
    </>
  )
}
