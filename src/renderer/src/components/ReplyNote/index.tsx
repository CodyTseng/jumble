import { Event } from 'nostr-tools'
import { formatTimestamp } from '@renderer/lib/timestamp'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function ReplyNote({ event, parentEvent }: { event: Event; parentEvent?: Event }) {
  return (
    <div className="flex space-x-2 items-start">
      <UserAvatar userId={event.pubkey} size="small" />
      <div className="w-full overflow-hidden">
        <div className="flex space-x-2 items-end">
          <Username
            userId={event.pubkey}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          />
          <div className="text-xs text-muted-foreground">{formatTimestamp(event.created_at)}</div>
        </div>
        {parentEvent && (
          <div className="text-xs text-muted-foreground truncate">
            <ParentReplyNote event={parentEvent} />
          </div>
        )}
        <Content event={event} size="small" />
      </div>
    </div>
  )
}

function ParentReplyNote({ event }: { event: Event }) {
  return (
    <div className="flex space-x-1 items-center text-xs">
      <div>reply to</div>
      <UserAvatar userId={event.pubkey} size="tiny" />
      <div className="truncate">{event.content}</div>
    </div>
  )
}
