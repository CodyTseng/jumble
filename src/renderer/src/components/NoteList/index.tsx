import { isReplyNoteEvent } from '@renderer/lib/event'
import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import { EVENT_TYPES, eventBus } from '@renderer/services/event-bus.service'
import dayjs from 'dayjs'
import { RefreshCcw } from 'lucide-react'
import { Event, Filter, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import NoteCard from '../NoteCard'

export default function NoteList({
  filter = {},
  className,
  isHomeTimeline = false
}: {
  filter?: Filter
  className?: string
  isHomeTimeline?: boolean
}) {
  const [events, setEvents] = useState<Event[]>([])
  const [since, setSince] = useState<number>(() => dayjs().unix() + 1)
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [refreshedAt, setRefreshedAt] = useState<number>(() => dayjs().unix())
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const observer = useRef<IntersectionObserver | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const noteFilter = useMemo(() => {
    return {
      kinds: [kinds.ShortTextNote, kinds.Repost],
      limit: 50,
      ...filter
    }
  }, [filter])

  useEffect(() => {
    if (!isHomeTimeline) return

    const handleClearList = () => {
      setEvents([])
      setSince(dayjs().unix() + 1)
      setUntil(dayjs().unix())
      setHasMore(true)
      setRefreshedAt(dayjs().unix())
      setRefreshing(false)
    }

    eventBus.on(EVENT_TYPES.RELOAD_TIMELINE, handleClearList)

    return () => {
      eventBus.remove(EVENT_TYPES.RELOAD_TIMELINE, handleClearList)
    }
  }, [])

  const loadMore = async () => {
    const events = await client.fetchEvents([{ ...noteFilter, until }])
    if (events.length === 0) {
      setHasMore(false)
      return
    }

    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
    const processedEvents = sortedEvents.filter((e) => !isReplyNoteEvent(e))
    if (processedEvents.length > 0) {
      setEvents((oldEvents) => [...oldEvents, ...processedEvents])
    }

    setUntil(sortedEvents[sortedEvents.length - 1].created_at - 1)
  }

  const refresh = async () => {
    const now = dayjs().unix()
    setRefreshing(true)
    const events = await client.fetchEvents([{ ...noteFilter, until: now, since }])

    const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
    const processedEvents = sortedEvents.filter((e) => !isReplyNoteEvent(e))
    if (sortedEvents.length >= noteFilter.limit) {
      // reset
      setEvents(processedEvents)
      setUntil(sortedEvents[sortedEvents.length - 1].created_at - 1)
    } else if (processedEvents.length > 0) {
      // append
      setEvents((oldEvents) => [...processedEvents, ...oldEvents])
    }

    if (sortedEvents.length > 0) {
      setSince(sortedEvents[0].created_at + 1)
    }

    setRefreshedAt(now)
    setRefreshing(false)
  }

  useEffect(() => {
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
  }, [until])

  return (
    <>
      {events.length > 0 && (
        <div
          className={`flex justify-center items-center gap-1 mb-2 text-muted-foreground ${!refreshing ? 'hover:text-foreground cursor-pointer' : ''}`}
          onClick={refresh}
        >
          <RefreshCcw size={12} className={`${refreshing ? 'animate-spin' : ''}`} />
          <div className="text-xs">
            {refreshing
              ? 'refreshing...'
              : `last refreshed at ${dayjs(refreshedAt * 1000).format('HH:mm:ss')}`}
          </div>
        </div>
      )}
      <div className={cn('flex flex-col gap-4', className)}>
        {events.map((event, i) => (
          <NoteCard key={i} className="w-full" event={event} />
        ))}
      </div>
      <div className="text-center text-xs text-muted-foreground mt-2">
        {hasMore ? <div ref={bottomRef}>loading...</div> : 'no more notes'}
      </div>
    </>
  )
}
