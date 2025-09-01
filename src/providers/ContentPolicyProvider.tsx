import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TContentPolicyContext = {
  autoplay: boolean
  setAutoplay: (autoplay: boolean) => void

  defaultShowNsfw: boolean
  setDefaultShowNsfw: (showNsfw: boolean) => void
  defaultShowMuted: boolean
  setDefaultShowMuted: (showMuted: boolean) => void
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
  const [defaultShowMuted, setDefaultShowMuted]=useState<boolean>(storage.getDefaultShowMuted())
  const updateAutoplay = (autoplay: boolean) => {
    storage.setAutoplay(autoplay)
    setAutoplay(autoplay)
  }

  const updateDefaultShowNsfw = (defaultShowNsfw: boolean) => {
    storage.setDefaultShowNsfw(defaultShowNsfw)
    setDefaultShowNsfw(defaultShowNsfw)
  }

  const updateDefaultShowMuted = (defaultShowMuted: boolean) => {
    storage.setDefaultShowMuted(defaultShowMuted)
    setDefaultShowMuted(defaultShowMuted)
  }

  return (
    <ContentPolicyContext.Provider
      value={{
        autoplay,
        setAutoplay: updateAutoplay,
        defaultShowNsfw,
        setDefaultShowNsfw: updateDefaultShowNsfw,
        defaultShowMuted,
        setDefaultShowMuted: updateDefaultShowMuted,
      }}
    >
      {children}
    </ContentPolicyContext.Provider>
  )
}
