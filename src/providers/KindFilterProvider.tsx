import { createContext, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'

type TKindFilterContext = {
  showKinds: number[]
  updateShowKinds: (kinds: number[]) => void
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

  const updateShowKinds = (kinds: number[]) => {
    storage.setShowKinds(kinds)
    setShowKinds(kinds)
  }

  return (
    <KindFilterContext.Provider value={{ showKinds, updateShowKinds }}>
      {children}
    </KindFilterContext.Provider>
  )
}
