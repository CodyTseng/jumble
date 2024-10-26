import { formatTimestamp } from '@renderer/lib/timestamp'
import { Event } from 'nostr-tools'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function Note({
  event,
  parentEvent,
  size = 'normal'
}: {
  event: Event
  parentEvent?: Event
  size?: 'normal' | 'small'
}) {
  return (
    <div>
      <div className="flex items-center space-x-2">
        <UserAvatar userId={event.pubkey} size={size === 'small' ? 'small' : 'normal'} />
        <div className="flex-1 w-0">
          <Username userId={event.pubkey} className="text-sm font-semibold max-w-fit flex" />
          <div className="text-xs text-muted-foreground">{formatTimestamp(event.created_at)}</div>
        </div>
      </div>
      {parentEvent && (
        <div className="text-xs text-muted-foreground truncate">
          <ParentNote event={parentEvent} />
        </div>
      )}
      <Content className="mt-2" event={event} />
    </div>
  )
}

function ParentNote({ event }: { event: Event }) {
  return (
    <div className="flex space-x-1 items-center text-xs">
      <div>reply to</div>
      <UserAvatar userId={event.pubkey} size="tiny" />
      <div className="truncate">{event.content}</div>
    </div>
  )
}
