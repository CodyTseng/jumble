import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import dmService from '@/services/dm.service'
import { TDmConversation } from '@/types'
import { useCallback, useEffect, useState } from 'react'

export function useDmUnread() {
  const { pubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const [unreadCount, setUnreadCount] = useState(0)
  const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.DM)

  const shouldIncludeConversation = useCallback(
    async (conversation: TDmConversation) => {
      if (mutePubkeySet.has(conversation.pubkey)) return false
      // Trust score filtering only applies to requests (unreplied conversations).
      if (
        !conversation.hasReplied &&
        trustScoreThreshold > 0 &&
        !(await meetsMinTrustScore(conversation.pubkey, trustScoreThreshold))
      ) {
        return false
      }
      return true
    },
    [mutePubkeySet, trustScoreThreshold, meetsMinTrustScore]
  )

  const check = useCallback(async () => {
    if (!pubkey) {
      setUnreadCount(0)
      return
    }
    const conversations = await dmService.getConversations(pubkey)
    let total = 0
    for (const c of conversations) {
      if (c.unreadCount <= 0) continue
      if (!(await shouldIncludeConversation(c))) continue
      total += c.unreadCount
    }
    setUnreadCount(total)
  }, [pubkey, shouldIncludeConversation])

  useEffect(() => {
    check()
    const unsub = dmService.onDataChanged(check)
    return unsub
  }, [check])

  return { hasUnread: unreadCount > 0, unreadCount, shouldIncludeConversation }
}
