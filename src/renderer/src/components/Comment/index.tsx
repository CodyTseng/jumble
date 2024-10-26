import { Event } from 'nostr-tools'
import { formatTimestamp } from '@renderer/lib/timestamp'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function Comment({
  comment,
  parentComment
}: {
  comment: Event
  parentComment?: Event
}) {
  return (
    <div className="flex space-x-2 items-start">
      <UserAvatar userId={comment.pubkey} />
      <div className="w-full overflow-hidden">
        <div className="flex space-x-2 items-center">
          <Username userId={comment.pubkey} className="text-sm font-semibold" />
          <div className="text-xs text-muted-foreground">{formatTimestamp(comment.created_at)}</div>
        </div>
        {parentComment && (
          <div className="text-xs text-muted-foreground truncate">
            <ParentComment comment={parentComment} />
          </div>
        )}
        <Content event={comment} />
      </div>
    </div>
  )
}

function ParentComment({ comment }: { comment: Event }) {
  return (
    <div className="flex space-x-1 items-center text-xs">
      <div>reply to</div>
      <UserAvatar userId={comment.pubkey} className="w-3 h-3" />
      <div className="truncate">{comment.content}</div>
    </div>
  )
}
