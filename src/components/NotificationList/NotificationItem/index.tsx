import { ExtendedKind } from '@/constants'
import { notificationFilter } from '@/lib/notification'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { HighlightNotification } from './HighlightNotification'
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
  const { pubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { hideUntrustedNotifications, isUserTrusted } = useUserTrust()
  const canShow = useMemo(() => {
    return notificationFilter(notification, {
      pubkey,
      mutePubkeySet,
      hideContentMentioningMutedUsers,
      hideUntrustedNotifications,
      isUserTrusted
    })
  }, [
    notification,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideUntrustedNotifications,
    isUserTrusted
  ])
  if (!canShow) return null

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
  if (notification.kind === kinds.Repost || notification.kind === kinds.GenericRepost) {
    return <RepostNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Zap) {
    return <ZapNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === ExtendedKind.POLL_RESPONSE) {
    return <PollResponseNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Highlights) {
    return <HighlightNotification notification={notification} isNew={isNew} />
  }
  return null
}
