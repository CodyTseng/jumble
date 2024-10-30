import { Separator } from '@renderer/components/ui/separator'
import { getParentEventId } from '@renderer/lib/event'
import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import { createReplyCountChangedEvent, eventBus } from '@renderer/services/event-bus.service'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import ReplyNote from '../ReplyNote'

export default function ReplyNoteList({ event, className }: { event: Event; className?: string }) {
  const [eventsWithParentIds, setEventsWithParentId] = useState<[Event, string | undefined][]>([])
  const [eventMap, setEventMap] = useState<Record<string, Event>>({})
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [loading, setLoading] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [highlightReplyId, setHighlightReplyId] = useState<string | undefined>(undefined)
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const loadMore = async () => {
    setLoading(true)
    const events = await client.fetchEvents({
      '#e': [event.id],
      kinds: [1],
      limit: 200,
      until
    })
    const sortedEvents = events.sort((a, b) => a.created_at - b.created_at)
    if (sortedEvents.length > 0) {
      const eventMap: Record<string, Event> = {}
      const eventsWithParentIds = sortedEvents.map((event) => {
        eventMap[event.id] = event
        return [event, getParentEventId(event)] as [Event, string | undefined]
      })
      setEventsWithParentId((pre) => [...eventsWithParentIds, ...pre])
      setEventMap((pre) => ({ ...pre, ...eventMap }))
      setUntil(sortedEvents[0].created_at - 1)
    }
    setHasMore(sortedEvents.length >= 200)
    setLoading(false)
  }

  useEffect(() => {
    loadMore()
  }, [])

  useEffect(() => {
    eventBus.emit(createReplyCountChangedEvent(event.id, eventsWithParentIds.length))
  }, [eventsWithParentIds])

  const onClickParent = (eventId: string) => {
    const ref = replyRefs.current[eventId]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }
    setHighlightReplyId(eventId)
    setTimeout(() => {
      setHighlightReplyId((pre) => (pre === eventId ? undefined : pre))
    }, 1500)
  }

  return (
    <>
      <div
        className={`text-xs text-center my-2 text-muted-foreground ${!loading ? 'hover:text-foreground cursor-pointer' : ''}`}
        onClick={loadMore}
      >
        {loading ? 'loading...' : hasMore ? 'load more older replies' : null}
      </div>
      {eventsWithParentIds.length > 0 && (loading || hasMore) && <Separator />}
      <div className={cn('mt-2', className)}>
        {eventsWithParentIds.map(([event, parentEventId], index) => (
          <div ref={(el) => (replyRefs.current[event.id] = el)} key={index}>
            <ReplyNote
              event={event}
              parentEvent={parentEventId ? eventMap[parentEventId] : undefined}
              onClickParent={onClickParent}
              highlight={highlightReplyId === event.id}
            />
          </div>
        ))}
      </div>
      {eventsWithParentIds.length === 0 && !loading && !hasMore && (
        <div className="text-xs text-center text-muted-foreground">no replies</div>
      )}
    </>
  )
}
