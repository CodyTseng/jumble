import { MEDIA_AUTO_LOAD_POLICY } from '@/constants'
import storage from '@/services/local-storage.service'
import { TMediaAutoLoadPolicy } from '@/types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type TContentPolicyContext = {
  autoplay: boolean
  setAutoplay: (autoplay: boolean) => void

  defaultShowNsfw: boolean
  setDefaultShowNsfw: (showNsfw: boolean) => void

  hideContentMentioningMutedUsers?: boolean
  setHideContentMentioningMutedUsers?: (hide: boolean) => void

  autoLoadMedia: boolean
  mediaAutoLoadPolicy: TMediaAutoLoadPolicy
  setMediaAutoLoadPolicy: (policy: TMediaAutoLoadPolicy) => void

  faviconUrlTemplate: string
  setFaviconUrlTemplate: (template: string) => void
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
  const [autoplay, setAutoplay] = useState(storage.getAutoplay())
  const [defaultShowNsfw, setDefaultShowNsfw] = useState(storage.getDefaultShowNsfw())
  const [hideContentMentioningMutedUsers, setHideContentMentioningMutedUsers] = useState(
    storage.getHideContentMentioningMutedUsers()
  )
  const [mediaAutoLoadPolicy, setMediaAutoLoadPolicy] = useState(storage.getMediaAutoLoadPolicy())
  const [faviconUrlTemplate, setFaviconUrlTemplate] = useState(storage.getFaviconUrlTemplate())
  const [connectionType, setConnectionType] = useState((navigator as any).connection?.type)

  useEffect(() => {
    const connection = (navigator as any).connection
    if (!connection) {
      setConnectionType(undefined)
      return
    }
    const handleConnectionChange = () => {
      setConnectionType(connection.type)
    }
    connection.addEventListener('change', handleConnectionChange)
    return () => {
      connection.removeEventListener('change', handleConnectionChange)
    }
  }, [])

  const autoLoadMedia = useMemo(() => {
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.ALWAYS) {
      return true
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.NEVER) {
      return false
    }
    // WIFI_ONLY
    return connectionType === 'wifi' || connectionType === 'ethernet'
  }, [mediaAutoLoadPolicy, connectionType])

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

  const updateMediaAutoLoadPolicy = (policy: TMediaAutoLoadPolicy) => {
    storage.setMediaAutoLoadPolicy(policy)
    setMediaAutoLoadPolicy(policy)
  }

  const updateFaviconUrlTemplate = (template: string) => {
    storage.setFaviconUrlTemplate(template)
    setFaviconUrlTemplate(template)
  }

  return (
    <ContentPolicyContext.Provider
      value={{
        autoplay,
        setAutoplay: updateAutoplay,
        defaultShowNsfw,
        setDefaultShowNsfw: updateDefaultShowNsfw,
        hideContentMentioningMutedUsers,
        setHideContentMentioningMutedUsers: updateHideContentMentioningMutedUsers,
        autoLoadMedia,
        mediaAutoLoadPolicy,
        setMediaAutoLoadPolicy: updateMediaAutoLoadPolicy,
        faviconUrlTemplate,
        setFaviconUrlTemplate: updateFaviconUrlTemplate
      }}
    >
      {children}
    </ContentPolicyContext.Provider>
  )
}
