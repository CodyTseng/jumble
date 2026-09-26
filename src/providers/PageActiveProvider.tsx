import { useLiveSubscriptionGate } from '@/hooks/useDocumentResume'
import { createContext, useContext } from 'react'

export const PageActiveContext = createContext<boolean | null>(null)

/**
 * Page is the current primary/secondary surface AND the document is not in a
 * long-backgrounded / pre-resume state. NoteList and UserAggregationList already
 * re-subscribe when this becomes true again, preserving sinceRef (#15).
 */
export function usePageActive() {
  const ctx = useContext(PageActiveContext)
  const live = useLiveSubscriptionGate()
  return (ctx ?? false) && live
}
