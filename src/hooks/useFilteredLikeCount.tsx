import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useEffect, useState } from 'react'
import { useStuffStatsById } from './useStuffStatsById'

export function useFilteredLikeCount(stuffKey: string) {
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const noteStats = useStuffStatsById(stuffKey)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const filterLikes = async () => {
      const likes = noteStats?.likes ?? []
      const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS)
      if (!trustScoreThreshold) {
        if (!cancelled) setCount(likes.length)
        return
      }
      let n = 0
      await Promise.all(
        likes.map(async (like) => {
          if (await meetsMinTrustScore(like.pubkey, trustScoreThreshold)) {
            n++
          }
        })
      )
      if (!cancelled) setCount(n)
    }
    filterLikes()
    return () => {
      cancelled = true
    }
  }, [noteStats, getMinTrustScore, meetsMinTrustScore])

  return count
}
