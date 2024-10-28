import { isReplyNoteEvent } from '@renderer/lib/event'
import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import NoteCard from '../NoteCard'

export default function NoteList({
  filter = {},
  className
}: {
  filter?: Filter
  className?: string
}) {
  const [events, setEvents] = useState<Event[]>([])
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const observer = useRef<IntersectionObserver | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const noteFilter = useMemo(() => {
    return {
      kinds: [kinds.ShortTextNote, kinds.Repost],
      limit: 50,
      ...filter
    }
  }, [filter])

  const loadMore = async () => {
    const events = await client.fetchEvents({ ...noteFilter, until })
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

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
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
    <div className={cn('flex flex-col gap-4', className)}>
      {events.map((event, i) => (
        <NoteCard key={i} className="w-full" event={event} />
      ))}
      {hasMore ? (
        <div ref={bottomRef} className="text-center text-sm text-muted-foreground">
          loading...
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground">no more notes</div>
      )}
    </div>
  )
}
