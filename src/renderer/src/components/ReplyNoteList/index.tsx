import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import ReplyNote from '../ReplyNote'

export default function ReplyNoteList({ event, className }: { event: Event; className?: string }) {
  const [eventsWithParentIds, setEventsWithParentId] = useState<[Event, string | undefined][]>([])
  const [eventMap, setEventMap] = useState<Record<string, Event>>({})
  const [until, setUntil] = useState<number>(() => dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(false)

  const loadMore = async () => {
    const events = await client.fetchEvents([
      {
        '#e': [event.id],
        kinds: [1],
        limit: 100,
        until
      }
    ])
    const sortedEvents = events.sort((a, b) => a.created_at - b.created_at)
    const eventMap: Record<string, Event> = {}
    const eventsWithParentIds = sortedEvents.map((event) => {
      eventMap[event.id] = event
      return [event, getParentEventId(event)] as [Event, string | undefined]
    })
    setEventsWithParentId((pre) => [...eventsWithParentIds, ...pre])
    setEventMap(eventMap)
    setUntil(sortedEvents[0].created_at - 1)
    setHasMore(sortedEvents.length >= 100)
  }

  useEffect(() => {
    loadMore()
  }, [])

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
      <div className={cn('space-y-6 mt-4', className)}>
        {eventsWithParentIds.map(([event, parentEventId], index) => (
          <ReplyNote
            key={index}
            event={event}
            parentEvent={parentEventId ? eventMap[parentEventId] : undefined}
          />
        ))}
      </div>
    </>
  )
}

function getParentEventId(event: Event) {
  return event.tags.find(([tagName, , , type]) => tagName === 'e' && type === 'reply')?.[1]
}
