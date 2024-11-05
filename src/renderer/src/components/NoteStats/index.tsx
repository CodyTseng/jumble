import { cn } from '@renderer/lib/utils'
import { Event } from 'nostr-tools'
import LikeButton from './LikeButton'
import NoteOptions from './NoteOptions'
import ReplyButton from './ReplyButton'
import RepostButton from './RepostButton'

export default function NoteStats({
  event,
  className,
  fetchIfNotExisting = false
}: {
  event: Event
  className?: string
  fetchIfNotExisting?: boolean
}) {
  return (
    <div className={cn('flex justify-between', className)}>
      <div className="flex gap-4 h-4 items-center">
        <ReplyButton event={event} />
        <RepostButton event={event} canFetch={fetchIfNotExisting} />
        <LikeButton event={event} canFetch={fetchIfNotExisting} />
      </div>
      <NoteOptions event={event} />
    </div>
  )
}
