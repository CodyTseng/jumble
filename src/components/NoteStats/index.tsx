import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import LikeButton from './LikeButton'
import NoteOptions from './NoteOptions'
import ReplyButton from './ReplyButton'
import RepostButton from './RepostButton'
import SeenOnButton from './SeenOnButton'

export default function NoteStats({
  event,
  className,
  fetchIfNotExisting = false,
  variant = 'note'
}: {
  event: Event
  className?: string
  fetchIfNotExisting?: boolean
  variant?: 'note' | 'reply'
}) {
  return (
    <div className={cn('flex justify-between', className)}>
      <div className="flex gap-5 h-4 items-center" onClick={(e) => e.stopPropagation()}>
        <ReplyButton event={event} variant={variant} />
        <RepostButton event={event} canFetch={fetchIfNotExisting} />
        <LikeButton event={event} canFetch={fetchIfNotExisting} />
      </div>
      <div className="flex gap-5 h-4 items-center" onClick={(e) => e.stopPropagation()}>
        <SeenOnButton event={event} />
        <NoteOptions event={event} />
      </div>
    </div>
  )
}
