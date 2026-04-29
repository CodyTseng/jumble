import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useEffect, useState } from 'react'
import { useStuffStatsById } from './useStuffStatsById'

export function useFilteredRepostCount(stuffKey: string) {
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const noteStats = useStuffStatsById(stuffKey)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const filterReposts = async () => {
      const reposts = noteStats?.reposts ?? []
      const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS)
      if (!trustScoreThreshold) {
        if (!cancelled) setCount(reposts.length)
        return
      }
      let n = 0
      await Promise.all(
        reposts.map(async (repost) => {
          if (await meetsMinTrustScore(repost.pubkey, trustScoreThreshold)) {
            n++
          }
        })
      )
      if (!cancelled) setCount(n)
    }
    filterReposts()
    return () => {
      cancelled = true
    }
  }, [noteStats, getMinTrustScore, meetsMinTrustScore])

  return count
}
