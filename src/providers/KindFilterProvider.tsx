import { createContext, useCallback, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'

type TKindFilterContext = {
  showKinds: number[]
  updateShowKinds: (kinds: number[]) => void
  getShowKinds: (feedId: string) => number[]
  updateShowKindsForFeed: (feedId: string, kinds: number[]) => void
  clearShowKindsForFeed: (feedId: string) => void
}

const KindFilterContext = createContext<TKindFilterContext | undefined>(undefined)

export const useKindFilter = () => {
  const context = useContext(KindFilterContext)
  if (!context) {
    throw new Error('useKindFilter must be used within a KindFilterProvider')
  }
  return context
}

export function KindFilterProvider({ children }: { children: React.ReactNode }) {
  const [showKinds, setShowKinds] = useState<number[]>(storage.getShowKinds())
  const [showKindsMap, setShowKindsMap] = useState<Record<string, number[]>>(
    storage.getShowKindsMap()
  )

  const updateShowKinds = (kinds: number[]) => {
    storage.setShowKinds(kinds)
    setShowKinds(kinds)
  }

  const getShowKinds = useCallback(
    (feedId: string): number[] => {
      return showKindsMap[feedId] ?? showKinds
    },
    [showKindsMap, showKinds]
  )

  const updateShowKindsForFeed = (feedId: string, kinds: number[]) => {
    const newMap = { ...showKindsMap, [feedId]: kinds }
    storage.setShowKindsForFeed(feedId, kinds)
    setShowKindsMap(newMap)
  }

  const clearShowKindsForFeed = (feedId: string) => {
    const { [feedId]: _, ...newMap } = showKindsMap
    storage.clearShowKindsForFeed(feedId)
    setShowKindsMap(newMap)
  }

  return (
    <KindFilterContext.Provider
      value={{ showKinds, updateShowKinds, getShowKinds, updateShowKindsForFeed, clearShowKindsForFeed }}
    >
      {children}
    </KindFilterContext.Provider>
  )
}
