import { Event } from 'nostr-tools'
import { formatTimestamp } from '@renderer/lib/timestamp'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function ReplyNote({
  event,
  parentEvent,
  onClickParent = () => {},
  highlight = false
}: {
  event: Event
  parentEvent?: Event
  onClickParent?: (eventId: string) => void
  highlight?: boolean
}) {
  return (
    <div
      className={`flex space-x-2 items-start rounded-lg p-2 transition-colors duration-500 ${highlight ? 'bg-highlight/50' : ''}`}
    >
      <UserAvatar userId={event.pubkey} size="small" className="shrink-0" />
      <div className="w-full overflow-hidden">
        <div className="flex gap-1 items-end">
          <Username
            userId={event.pubkey}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground truncate"
          />
          <div className="text-xs text-muted-foreground shrink-0">
            {formatTimestamp(event.created_at)}
          </div>
        </div>
        {parentEvent && (
          <div
            className="text-xs text-muted-foreground truncate hover:text-foreground cursor-pointer"
            onClick={() => onClickParent(parentEvent.id)}
          >
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
    <div className="flex space-x-1 items-center text-xs border rounded-lg w-fit px-1 bg-muted max-w-full">
      <div>reply to</div>
      <UserAvatar userId={event.pubkey} size="tiny" />
      <div className="truncate">{event.content}</div>
    </div>
  )
}
