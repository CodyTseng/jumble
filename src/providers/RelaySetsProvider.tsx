import { randomString } from '@/lib/random'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import storage from '@/services/storage.service'
import { TRelaySet } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'

type TRelaySetsContext = {
  relaySets: TRelaySet[]
  addRelaySet: (relaySetName: string, relayUrls?: string[]) => string
  deleteRelaySet: (id: string) => void
  updateRelaySet: (newSet: TRelaySet) => void
  mergeRelaySets: (newSets: TRelaySet[]) => void
}

const RelaySetsContext = createContext<TRelaySetsContext | undefined>(undefined)

export const useRelaySets = () => {
  const context = useContext(RelaySetsContext)
  if (!context) {
    throw new Error('useRelaySets must be used within a RelaySetsProvider')
  }
  return context
}

export function RelaySetsProvider({ children }: { children: React.ReactNode }) {
  const [relaySets, setRelaySets] = useState<TRelaySet[]>(() => storage.getRelaySets())

  useEffect(() => {
    storage.setRelaySets(relaySets)
  }, [relaySets])

  const deleteRelaySet = (id: string) => {
    setRelaySets((pre) => pre.filter((set) => set.id !== id))
  }

  const updateRelaySet = (newSet: TRelaySet) => {
    setRelaySets((pre) => {
      return pre.map((set) => (set.id === newSet.id ? newSet : set))
    })
  }

  const addRelaySet = (relaySetName: string, relayUrls: string[] = []) => {
    const normalizedUrls = relayUrls
      .filter((url) => isWebsocketUrl(url))
      .map((url) => normalizeUrl(url))
    const id = randomString()
    setRelaySets((pre) => {
      return [
        ...pre,
        {
          id,
          name: relaySetName,
          relayUrls: normalizedUrls
        }
      ]
    })
    return id
  }

  const mergeRelaySets = (newSets: TRelaySet[]) => {
    setRelaySets((pre) => {
      const newIds = newSets.map((set) => set.id)
      return pre.filter((set) => !newIds.includes(set.id)).concat(newSets)
    })
  }

  return (
    <RelaySetsContext.Provider
      value={{
        relaySets,
        addRelaySet,
        deleteRelaySet,
        updateRelaySet,
        mergeRelaySets
      }}
    >
      {children}
    </RelaySetsContext.Provider>
  )
}
