import pollResults from '@/services/poll-results.service'
import { useSyncExternalStore } from 'react'

export function useFetchPollResults(pollEventId: string) {
  return useSyncExternalStore(
    (cb) => pollResults.subscribePollResults(pollEventId, cb),
    () => pollResults.getPollResults(pollEventId)
  )
}
