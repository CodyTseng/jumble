import { Event } from 'nostr-tools'
import { formatTimestamp } from '@renderer/lib/timestamp'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import LikeButton from '../NoteStats/LikeButton'
import PostDialog from '../PostDialog'

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
        <Username
          userId={event.pubkey}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground truncate"
        />
        {parentEvent && (
          <div
            className="text-xs text-muted-foreground truncate hover:text-foreground cursor-pointer"
            onClick={() => onClickParent(parentEvent.id)}
          >
            <ParentReplyNote event={parentEvent} />
          </div>
        )}
        <Content event={event} size="small" />
        <div className="flex gap-2 text-xs">
          <div className="text-muted-foreground/60">{formatTimestamp(event.created_at)}</div>
          <PostDialog parentEvent={event}>
            <div className="text-muted-foreground hover:text-primary cursor-pointer">reply</div>
          </PostDialog>
        </div>
      </div>
      <LikeButton event={event} variant="reply" />
    </div>
  )
}

function ParentReplyNote({ event }: { event: Event }) {
  return (
    <div className="flex space-x-1 items-center text-xs rounded-lg w-fit px-2 bg-muted max-w-full">
      <div className="shrink-0">reply to</div>
      <UserAvatar userId={event.pubkey} size="tiny" />
      <div className="truncate">{event.content}</div>
    </div>
  )
}
