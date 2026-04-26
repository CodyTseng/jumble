import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { notificationFilter } from '@/lib/notification'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { NostrEvent } from 'nostr-tools'
import { useCallback } from 'react'

export function useNotificationFilter() {
  const { pubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.NOTIFICATIONS)

  return useCallback(
    (event: NostrEvent) =>
      notificationFilter(event, {
        pubkey,
        mutePubkeySet,
        hideContentMentioningMutedUsers,
        meetsMinTrustScore: async (target: string) => {
          if (trustScoreThreshold === 0) return true
          return meetsMinTrustScore(target, trustScoreThreshold)
        }
      }),
    [
      pubkey,
      mutePubkeySet,
      hideContentMentioningMutedUsers,
      trustScoreThreshold,
      meetsMinTrustScore
    ]
  )
}
