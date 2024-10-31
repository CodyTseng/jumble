import useFetchEventStats from '@renderer/hooks/useFetchEventStats'
import { cn } from '@renderer/lib/utils'
import { EVENT_TYPES, eventBus } from '@renderer/services/event-bus.service'
import { Heart, MessageCircle, Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import NoteOptionsTrigger from './NoteOptionsTrigger'

export default function NoteStats({ event, className }: { event: Event; className?: string }) {
  const [replyCount, setReplyCount] = useState(0)
  const { stats } = useFetchEventStats(event.id)

  useEffect(() => {
    const handler = (e: CustomEvent<{ eventId: string; replyCount: number }>) => {
      const { eventId, replyCount } = e.detail
      if (eventId === event.id) {
        setReplyCount(replyCount)
      }
    }
    eventBus.on(EVENT_TYPES.REPLY_COUNT_CHANGED, handler)

    return () => {
      eventBus.remove(EVENT_TYPES.REPLY_COUNT_CHANGED, handler)
    }
  }, [])

  return (
    <div className={cn('flex justify-between', className)}>
      <div className="flex gap-1 items-center text-muted-foreground">
        <MessageCircle size={14} />
        <div className="text-xs">{formatCount(replyCount)}</div>
      </div>
      <div className="flex gap-1 items-center text-muted-foreground">
        <Repeat size={14} />
        <div className="text-xs">{formatCount(stats.repostCount)}</div>
      </div>
      <div className="flex gap-1 items-center text-muted-foreground">
        <Heart size={14} />
        <div className="text-xs">{formatCount(stats.reactionCount)}</div>
      </div>
      <NoteOptionsTrigger event={event} />
    </div>
  )
}

function formatCount(count: number) {
  return count >= 100 ? '99+' : count
}
