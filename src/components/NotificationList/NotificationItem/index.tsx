import { ExtendedKind } from '@/constants'
import { isMentioningMutedUsers } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { MentionNotification } from './MentionNotification'
import { PollResponseNotification } from './PollResponseNotification'
import { ReactionNotification } from './ReactionNotification'
import { RepostNotification } from './RepostNotification'
import { ZapNotification } from './ZapNotification'

export function NotificationItem({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const shouldHide = useMemo(() => {
    if (mutePubkeySet.has(notification.pubkey)) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(notification, mutePubkeySet)) {
      return true
    }
    return false
  }, [])
  if (shouldHide) return null

  if (notification.kind === kinds.Reaction) {
    return <ReactionNotification notification={notification} isNew={isNew} />
  }
  if (
    notification.kind === kinds.ShortTextNote ||
    notification.kind === ExtendedKind.COMMENT ||
    notification.kind === ExtendedKind.VOICE_COMMENT ||
    notification.kind === ExtendedKind.POLL
  ) {
    return <MentionNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Repost) {
    return <RepostNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Zap) {
    return <ZapNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === ExtendedKind.POLL_RESPONSE) {
    return <PollResponseNotification notification={notification} isNew={isNew} />
  }
  return null
}
