import storage from '@/services/local-storage.service'
import mediaUpload from '@/services/media-upload.service'
import { TMediaUploadServiceConfig } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

type TMediaUploadServiceContext = {
  serviceConfig: TMediaUploadServiceConfig
  updateServiceConfig: (service: TMediaUploadServiceConfig) => void
}

const MediaUploadServiceContext = createContext<TMediaUploadServiceContext | undefined>(undefined)

export const useMediaUploadService = () => {
  const context = useContext(MediaUploadServiceContext)
  if (!context) {
    throw new Error('useMediaUploadService must be used within MediaUploadServiceProvider')
  }
  return context
}

export function MediaUploadServiceProvider({ children }: { children: React.ReactNode }) {
  const { pubkey, startLogin } = useNostr()
  const [serviceConfig, setServiceConfig] = useState(storage.getMediaUploadServiceConfig())

  useEffect(() => {
    const serviceConfig = storage.getMediaUploadServiceConfig(pubkey)
    setServiceConfig(serviceConfig)
    mediaUpload.setServiceConfig(serviceConfig)
  }, [pubkey])

  const updateServiceConfig = (newService: TMediaUploadServiceConfig) => {
    if (!pubkey) {
      startLogin()
      return
    }
    setServiceConfig(newService)
    storage.setMediaUploadServiceConfig(pubkey, newService)
    mediaUpload.setServiceConfig(newService)
  }

  return (
    <MediaUploadServiceContext.Provider value={{ serviceConfig, updateServiceConfig }}>
      {children}
    </MediaUploadServiceContext.Provider>
  )
}
