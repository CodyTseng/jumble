import { formatTimestamp } from '@renderer/lib/timestamp'
import { cn } from '@renderer/lib/utils'
import { Ellipsis, Heart, MessageCircle, Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import useFetchEventStats from '@renderer/hooks/useFetchEventStats'
import { useEffect, useState } from 'react'
import { EVENT_TYPES, eventBus } from '@renderer/services/event-bus.service'

export default function Note({
  event,
  parentEvent,
  size = 'normal',
  className,
  displayStats = false
}: {
  event: Event
  parentEvent?: Event
  size?: 'normal' | 'small'
  className?: string
  displayStats?: boolean
}) {
  return (
    <div className={className}>
      <div className="flex items-center space-x-2">
        <UserAvatar userId={event.pubkey} size={size === 'small' ? 'small' : 'normal'} />
        <div className="flex-1 w-0">
          <Username
            userId={event.pubkey}
            className={`font-semibold max-w-fit flex ${size === 'small' ? 'text-xs' : 'text-sm'}`}
          />
          <div className="text-xs text-muted-foreground">{formatTimestamp(event.created_at)}</div>
        </div>
      </div>
      {parentEvent && (
        <div className="text-xs text-muted-foreground truncate mt-2">
          <ParentNote event={parentEvent} />
        </div>
      )}
      <Content className="mt-2" event={event} />
      {displayStats && <NoteStats className="mt-2" event={event} />}
    </div>
  )
}

function ParentNote({ event }: { event: Event }) {
  return (
    <div className="flex space-x-1 items-center text-xs rounded-lg border px-1 bg-muted w-fit max-w-full">
      <div>reply to</div>
      <UserAvatar userId={event.pubkey} size="tiny" />
      <div className="truncate">{event.content}</div>
    </div>
  )
}

function NoteStats({ event, className }: { event: Event; className?: string }) {
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
      <div className="flex gap-1 items-center">
        <MessageCircle size={16} />
        <div className="text-xs">{replyCount >= 100 ? '99+' : replyCount}</div>
      </div>
      <div className="flex gap-1 items-center">
        <Repeat size={16} />
        <div className="text-xs">{stats.repostCount >= 100 ? '99+' : stats.repostCount}</div>
      </div>
      <div className="flex gap-1 items-center">
        <Heart size={16} />
        <div className="text-xs">{stats.reactionCount >= 100 ? '99+' : stats.reactionCount}</div>
      </div>
      <Ellipsis size={16} />
    </div>
  )
}
