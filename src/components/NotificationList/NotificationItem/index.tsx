import { ExtendedKind } from '@/constants'
import { isMentioningMutedUsers } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useState } from 'react'
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
  const { minTrustScore, meetsMinTrustScore } = useUserTrust()
  const [canShow, setCanShow] = useState(false)

  useEffect(() => {
    const checkCanShow = async () => {
      // Check muted users
      if (mutePubkeySet.has(notification.pubkey)) {
        setCanShow(false)
        return
      }

      // Check content mentioning muted users
      if (hideContentMentioningMutedUsers && isMentioningMutedUsers(notification, mutePubkeySet)) {
        setCanShow(false)
        return
      }

      // Check trust score
      if (!(await meetsMinTrustScore(notification.pubkey))) {
        setCanShow(false)
        return
      }

      // Check reaction target for kind 7
      if (pubkey && notification.kind === kinds.Reaction) {
        const targetPubkey = notification.tags.findLast(tagNameEquals('p'))?.[1]
        if (targetPubkey !== pubkey) {
          setCanShow(false)
          return
        }
      }

      setCanShow(true)
    }

    checkCanShow()
  }, [
    notification,
    pubkey,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    minTrustScore,
    meetsMinTrustScore
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
