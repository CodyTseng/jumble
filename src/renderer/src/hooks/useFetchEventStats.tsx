import client from '@renderer/services/client.service'
import { TEventStats } from '@renderer/types'
import { useEffect, useState } from 'react'

export default function useFetchEventStats(eventId: string) {
  const [stats, setStats] = useState<TEventStats>({
    reactionCount: 0,
    repostCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const stats = await client.fetchEventStatsById(eventId)
        setStats(stats)
      } catch (error) {
        console.error('Failed to fetch event stats', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [eventId])

  return { stats, loading }
}
