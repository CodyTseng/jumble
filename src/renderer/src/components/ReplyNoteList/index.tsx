import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import ReplyNote from '../ReplyNote'

export default function ReplyNoteList({ event, className }: { event: Event; className?: string }) {
  const [events, setEvents] = useState<Event[]>([])

  const init = async () => {
    const events = await client.fetchEvents([
      {
        '#e': [event.id],
        kinds: [1],
        limit: 1000
      }
    ])
    setEvents(events.sort((a, b) => a.created_at - b.created_at))
  }

  useEffect(() => {
    init()
  }, [])

  return (
    <div className={cn('space-y-6', className)}>
      {events.map((event, index) => {
        const parentEventId = event.tags.find(
          ([tagName, , , type]) => tagName === 'e' && type === 'reply'
        )?.[1]
        const parentEvent = parentEventId ? events.find((c) => c.id === parentEventId) : undefined
        return <ReplyNote key={index} event={event} parentEvent={parentEvent} />
      })}
    </div>
  )
}
