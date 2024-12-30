import { TFeedType } from '@/types'
import { createContext, useContext, useState } from 'react'

type TFeedContext = {
  feedType: TFeedType
  setFeedType: (feedType: TFeedType) => void
}

const FeedContext = createContext<TFeedContext | undefined>(undefined)

export const useFeed = () => {
  const context = useContext(FeedContext)
  if (!context) {
    throw new Error('useFeed must be used within a FeedProvider')
  }
  return context
}

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [feedType, setFeedType] = useState<TFeedType>('relays')

  return <FeedContext.Provider value={{ feedType, setFeedType }}>{children}</FeedContext.Provider>
}
