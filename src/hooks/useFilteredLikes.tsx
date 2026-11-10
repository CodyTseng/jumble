import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useMuteList } from '@/providers/MuteListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { TStuffStats } from '@/services/stuff-stats.service'
import { useEffect, useState } from 'react'
import { useStuffStatsById } from './useStuffStatsById'

export function useFilteredLikes(stuffKey: string) {
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const noteStats = useStuffStatsById(stuffKey)
  const [filteredLikes, setFilteredLikes] = useState<TStuffStats['likes']>([])

  useEffect(() => {
    let cancelled = false
    const filterLikes = async () => {
      const likes = (noteStats?.likes ?? []).filter((like) => !mutePubkeySet.has(like.pubkey))
      const threshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS)
      if (!threshold) {
        if (!cancelled) setFilteredLikes(likes)
        return
      }
      const trusted = await Promise.all(
        likes.map((like) => meetsMinTrustScore(like.pubkey, threshold))
      )
      if (!cancelled) setFilteredLikes(likes.filter((_, index) => trusted[index]))
    }
    filterLikes()
    return () => {
      cancelled = true
    }
  }, [noteStats, stuffKey, mutePubkeySet, getMinTrustScore, meetsMinTrustScore])

  return filteredLikes
}
