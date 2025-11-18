import stuffStats from '@/services/stuff-stats.service'
import { useSyncExternalStore } from 'react'

export function useStuffStatsById(stuffKey: string) {
  return useSyncExternalStore(
    (cb) => stuffStats.subscribeStuffStats(stuffKey, cb),
    () => stuffStats.getStuffStats(stuffKey)
  )
}
