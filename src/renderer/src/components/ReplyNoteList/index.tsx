import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import ReplyNote from '../ReplyNote'

export default function ReplyNoteList({ event, className }: { event: Event; className?: string }) {
  const [eventsWithParentIds, setEventsWithParentId] = useState<[Event, string | undefined][]>([])
  const [eventMap, setEventMap] = useState<Record<string, Event>>({})
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [highlightReplyId, setHighlightReplyId] = useState<string | undefined>(undefined)
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const loadMore = async () => {
    const events = await client.fetchEvents({
      '#e': [event.id],
      kinds: [1],
      limit: 100,
      until
    })
    const sortedEvents = events.sort((a, b) => a.created_at - b.created_at)
    if (sortedEvents.length === 0) {
      setHasMore(false)
      return
    }

    const eventMap: Record<string, Event> = {}
    const eventsWithParentIds = sortedEvents.map((event) => {
      eventMap[event.id] = event
      return [event, getParentEventId(event)] as [Event, string | undefined]
    })
    setEventsWithParentId((pre) => [...eventsWithParentIds, ...pre])
    setEventMap((pre) => ({ ...pre, ...eventMap }))
    setHasMore(sortedEvents.length >= 100)
    setUntil(sortedEvents[0].created_at - 1)
  }

  useEffect(() => {
    loadMore()
  }, [])

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
      {hasMore && (
        <>
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground hover:text-foreground mt-1 h-7"
            onClick={loadMore}
          >
            Load more older replies
          </Button>
          <Separator className="mt-1" />
        </>
      )}
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
    </>
  )
}

function getParentEventId(event: Event) {
  return event.tags.find(([tagName, , , type]) => tagName === 'e' && type === 'reply')?.[1]
}
