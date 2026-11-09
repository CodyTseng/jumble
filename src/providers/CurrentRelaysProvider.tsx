import client from '@/services/client.service'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type TCurrentRelaysContext = {
  relayUrls: string[]
  addRelayUrls: (urls: string[]) => void
  removeRelayUrls: (urls: string[]) => void
}

const CurrentRelaysContext = createContext<TCurrentRelaysContext | undefined>(undefined)

export const useCurrentRelays = () => {
  const context = useContext(CurrentRelaysContext)
  if (!context) {
    throw new Error('useCurrentRelays must be used within a CurrentRelaysProvider')
  }
  return context
}

export function CurrentRelaysProvider({ children }: { children: React.ReactNode }) {
  const [relayRefCount, setRelayRefCount] = useState<Record<string, number>>({})
  const relayUrls = useMemo(() => Object.keys(relayRefCount), [relayRefCount])

  const countsRef = useRef<Record<string, number>>({})

  useEffect(() => () => client.setCurrentRelays([]), [])

  const updateRelayUrls = useCallback((urls: string[], delta: number) => {
    const newCounts = { ...countsRef.current }
    urls.forEach((url) => {
      newCounts[url] = (newCounts[url] || 0) + delta
      if (newCounts[url] <= 0) delete newCounts[url]
    })
    countsRef.current = newCounts
    // Update the policy immediately, before feed subscriptions start.
    client.setCurrentRelays(Object.keys(newCounts))
    setRelayRefCount(newCounts)
  }, [])

  const addRelayUrls = useCallback((urls: string[]) => updateRelayUrls(urls, 1), [updateRelayUrls])
  const removeRelayUrls = useCallback(
    (urls: string[]) => updateRelayUrls(urls, -1),
    [updateRelayUrls]
  )

  return (
    <CurrentRelaysContext.Provider value={{ relayUrls, addRelayUrls, removeRelayUrls }}>
      {children}
    </CurrentRelaysContext.Provider>
  )
}
