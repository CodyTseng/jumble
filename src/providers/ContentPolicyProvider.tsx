import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TContentPolicyContext = {
  autoplay: boolean
  setAutoplay: (autoplay: boolean) => void

  defaultShowNsfw: boolean
  setDefaultShowNsfw: (showNsfw: boolean) => void

  hideContentMentioningMutedUsers?: boolean
  setHideContentMentioningMutedUsers?: (hide: boolean) => void
}

const ContentPolicyContext = createContext<TContentPolicyContext | undefined>(undefined)

export const useContentPolicy = () => {
  const context = useContext(ContentPolicyContext)
  if (!context) {
    throw new Error('useContentPolicy must be used within an ContentPolicyProvider')
  }
  return context
}

export function ContentPolicyProvider({ children }: { children: React.ReactNode }) {
  const [autoplay, setAutoplay] = useState<boolean>(storage.getAutoplay())
  const [defaultShowNsfw, setDefaultShowNsfw] = useState<boolean>(storage.getDefaultShowNsfw())
  const [hideContentMentioningMutedUsers, setHideContentMentioningMutedUsers] = useState<boolean>(
    storage.getHideContentMentioningMutedUsers()
  )

  const updateAutoplay = (autoplay: boolean) => {
    storage.setAutoplay(autoplay)
    setAutoplay(autoplay)
  }

  const updateDefaultShowNsfw = (defaultShowNsfw: boolean) => {
    storage.setDefaultShowNsfw(defaultShowNsfw)
    setDefaultShowNsfw(defaultShowNsfw)
  }

  const updateHideContentMentioningMutedUsers = (hide: boolean) => {
    storage.setHideContentMentioningMutedUsers(hide)
    setHideContentMentioningMutedUsers(hide)
  }

  return (
    <ContentPolicyContext.Provider
      value={{
        autoplay,
        setAutoplay: updateAutoplay,
        defaultShowNsfw,
        setDefaultShowNsfw: updateDefaultShowNsfw,
        hideContentMentioningMutedUsers,
        setHideContentMentioningMutedUsers: updateHideContentMentioningMutedUsers
      }}
    >
      {children}
    </ContentPolicyContext.Provider>
  )
}
