import { createContext, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'
import { TShowPosts } from '@/types'

type TShowPostsContext = {
  showPosts: TShowPosts
  setShowPosts: (showPosts: TShowPosts) => void
}

const ShowPostsContext = createContext<TShowPostsContext | undefined>(undefined)

export const useShowPosts = () => {
  const context = useContext(ShowPostsContext)
  if (!context) {
    throw new Error('useShowPosts must be used within an ShowPostsProvider')
  }
  return context
}

export function ShowPostsProvider({ children }: { children: React.ReactNode }) {
  const [showPosts, setShowPosts] = useState<TShowPosts>(storage.getShowPosts())

  const updateShowPosts = (showPosts: TShowPosts) => {
    storage.setShowPosts(showPosts)
    setShowPosts(showPosts)
  }

  return (
    <ShowPostsContext.Provider value={{ showPosts, setShowPosts: updateShowPosts }}>
      {children}
    </ShowPostsContext.Provider>
  )
}
