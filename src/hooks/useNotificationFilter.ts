import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { notificationFilter } from '@/lib/notification'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import { nip19, NostrEvent } from 'nostr-tools'
import { useCallback } from 'react'
import { useMutedNoteNotifications } from './useMutedNoteNotifications'

export function useNotificationFilter() {
  const { pubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const { mutedNoteKeys } = useMutedNoteNotifications()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.NOTIFICATIONS)

  return useCallback(
    (event: NostrEvent) =>
      notificationFilter(event, {
        pubkey,
        mutePubkeySet,
        mutedNoteKeys,
        resolveNote: (id, author) => client.fetchEvent(nip19.neventEncode({ id, author })),
        hideContentMentioningMutedUsers,
        validateZapReceipt: (receipt) => lightning.validateZapReceipt(receipt),
        meetsMinTrustScore: async (target: string) => {
          if (trustScoreThreshold === 0) return true
          return meetsMinTrustScore(target, trustScoreThreshold)
        }
      }),
    [
      pubkey,
      mutePubkeySet,
      mutedNoteKeys,
      hideContentMentioningMutedUsers,
      trustScoreThreshold,
      meetsMinTrustScore
    ]
  )
}
