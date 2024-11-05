import { formatTimestamp } from '@renderer/lib/timestamp'
import { Event } from 'nostr-tools'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import NoteStats from '../NoteStats'

export default function Note({
  event,
  parentEvent,
  size = 'normal',
  className,
  hideStats = false,
  fetchNoteStats = false
}: {
  event: Event
  parentEvent?: Event
  size?: 'normal' | 'small'
  className?: string
  hideStats?: boolean
  fetchNoteStats?: boolean
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
      {!hideStats && (
        <NoteStats className="mt-2" event={event} fetchIfNotExisting={fetchNoteStats} />
      )}
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
