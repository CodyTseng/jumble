import { MEDIA_AUTO_LOAD_POLICY, PROFILE_PICTURE_AUTO_LOAD_POLICY } from '@/constants'
import storage from '@/services/local-storage.service'
import { TMediaAutoLoadPolicy, TProfilePictureAutoLoadPolicy, TNsfwDisplayPolicy } from '@/types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type TContentPolicyContext = {
  autoplay: boolean
  setAutoplay: (autoplay: boolean) => void

  videoLoop: boolean
  setVideoLoop: (videoLoop: boolean) => void

  nsfwDisplayPolicy: TNsfwDisplayPolicy
  setNsfwDisplayPolicy: (policy: TNsfwDisplayPolicy) => void

  hideContentMentioningMutedUsers?: boolean
  setHideContentMentioningMutedUsers?: (hide: boolean) => void

  autoLoadMedia: boolean
  mediaAutoLoadPolicy: TMediaAutoLoadPolicy
  setMediaAutoLoadPolicy: (policy: TMediaAutoLoadPolicy) => void

  autoLoadProfilePicture: boolean
  profilePictureAutoLoadPolicy: TProfilePictureAutoLoadPolicy
  setProfilePictureAutoLoadPolicy: (policy: TProfilePictureAutoLoadPolicy) => void

  faviconUrlTemplate: string
  setFaviconUrlTemplate: (template: string) => void

  mutedWords: string[]
  setMutedWords: (words: string[]) => void
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
  const [videoLoop, setVideoLoop] = useState(storage.getVideoLoop())
  const [nsfwDisplayPolicy, setNsfwDisplayPolicy] = useState(storage.getNsfwDisplayPolicy())
  const [hideContentMentioningMutedUsers, setHideContentMentioningMutedUsers] = useState(
    storage.getHideContentMentioningMutedUsers()
  )
  const [mediaAutoLoadPolicy, setMediaAutoLoadPolicy] = useState(storage.getMediaAutoLoadPolicy())
  const [profilePictureAutoLoadPolicy, setProfilePictureAutoLoadPolicy] = useState(
    storage.getProfilePictureAutoLoadPolicy()
  )
  const [faviconUrlTemplate, setFaviconUrlTemplate] = useState(storage.getFaviconUrlTemplate())
  const [mutedWords, setMutedWords] = useState(storage.getMutedWords())
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

  const autoLoadProfilePicture = useMemo(() => {
    if (profilePictureAutoLoadPolicy === PROFILE_PICTURE_AUTO_LOAD_POLICY.ALWAYS) {
      return true
    }
    if (profilePictureAutoLoadPolicy === PROFILE_PICTURE_AUTO_LOAD_POLICY.NEVER) {
      return false
    }
    // WIFI_ONLY
    return connectionType === 'wifi' || connectionType === 'ethernet'
  }, [profilePictureAutoLoadPolicy, connectionType])

  const updateAutoplay = (autoplay: boolean) => {
    storage.setAutoplay(autoplay)
    setAutoplay(autoplay)
  }

  const updateVideoLoop = (videoLoop: boolean) => {
    storage.setVideoLoop(videoLoop)
    setVideoLoop(videoLoop)
  }

  const updateNsfwDisplayPolicy = (policy: TNsfwDisplayPolicy) => {
    storage.setNsfwDisplayPolicy(policy)
    setNsfwDisplayPolicy(policy)
  }

  const updateHideContentMentioningMutedUsers = (hide: boolean) => {
    storage.setHideContentMentioningMutedUsers(hide)
    setHideContentMentioningMutedUsers(hide)
  }

  const updateMediaAutoLoadPolicy = (policy: TMediaAutoLoadPolicy) => {
    storage.setMediaAutoLoadPolicy(policy)
    setMediaAutoLoadPolicy(policy)
  }

  const updateProfilePictureAutoLoadPolicy = (policy: TProfilePictureAutoLoadPolicy) => {
    storage.setProfilePictureAutoLoadPolicy(policy)
    setProfilePictureAutoLoadPolicy(policy)
  }

  const updateFaviconUrlTemplate = (template: string) => {
    storage.setFaviconUrlTemplate(template)
    setFaviconUrlTemplate(template)
  }

  const updateMutedWords = (words: string[]) => {
    storage.setMutedWords(words)
    setMutedWords(words)
  }

  return (
    <ContentPolicyContext.Provider
      value={{
        autoplay,
        setAutoplay: updateAutoplay,
        videoLoop,
        setVideoLoop: updateVideoLoop,
        nsfwDisplayPolicy,
        setNsfwDisplayPolicy: updateNsfwDisplayPolicy,
        hideContentMentioningMutedUsers,
        setHideContentMentioningMutedUsers: updateHideContentMentioningMutedUsers,
        autoLoadMedia,
        mediaAutoLoadPolicy,
        setMediaAutoLoadPolicy: updateMediaAutoLoadPolicy,
        autoLoadProfilePicture,
        profilePictureAutoLoadPolicy,
        setProfilePictureAutoLoadPolicy: updateProfilePictureAutoLoadPolicy,
        faviconUrlTemplate,
        setFaviconUrlTemplate: updateFaviconUrlTemplate,
        mutedWords,
        setMutedWords: updateMutedWords
      }}
    >
      {children}
    </ContentPolicyContext.Provider>
  )
}
