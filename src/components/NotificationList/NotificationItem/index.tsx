import { COMMENT_EVENT_KIND } from '@/constants'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { CommentNotification } from './CommentNotification'
import { ReactionNotification } from './ReactionNotification'
import { ReplyNotification } from './ReplyNotification'
import { RepostNotification } from './RepostNotification'
import { ZapNotification } from './ZapNotification'

export function NotificationItem({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { mutePubkeys } = useMuteList()
  if (mutePubkeys.includes(notification.pubkey)) {
    return null
  }
  if (notification.kind === kinds.Reaction) {
    return <ReactionNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.ShortTextNote) {
    return <ReplyNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Repost) {
    return <RepostNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Zap) {
    return <ZapNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === COMMENT_EVENT_KIND) {
    return <CommentNotification notification={notification} isNew={isNew} />
  }
  return null
}
