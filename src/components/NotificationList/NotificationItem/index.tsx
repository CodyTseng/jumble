import { COMMENT_EVENT_KIND } from '@/constants'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { CommentNotification } from './CommentNotification'
import { ReactionNotification } from './ReactionNotification'
import { ReplyNotification } from './ReplyNotification'
import { RepostNotification } from './RepostNotification'
import { ZapNotification } from './ZapNotification'

export function NotificationItem({ notification }: { notification: Event }) {
  const { mutePubkeys } = useMuteList()
  if (mutePubkeys.includes(notification.pubkey)) {
    return null
  }
  if (notification.kind === kinds.Reaction) {
    return <ReactionNotification notification={notification} />
  }
  if (notification.kind === kinds.ShortTextNote) {
    return <ReplyNotification notification={notification} />
  }
  if (notification.kind === kinds.Repost) {
    return <RepostNotification notification={notification} />
  }
  if (notification.kind === kinds.Zap) {
    return <ZapNotification notification={notification} />
  }
  if (notification.kind === COMMENT_EVENT_KIND) {
    return <CommentNotification notification={notification} />
  }
  return null
}
