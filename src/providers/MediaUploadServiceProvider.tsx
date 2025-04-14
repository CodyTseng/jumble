import { simplifyUrl } from '@/lib/url'
import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TMediaUploadServiceContext = {
  service: string
  updateService: (service: string) => void
  upload: (file: File) => Promise<{ url: string; tags: string[][] }>
}

const MediaUploadServiceContext = createContext<TMediaUploadServiceContext | undefined>(undefined)

export const useMediaUploadService = () => {
  const context = useContext(MediaUploadServiceContext)
  if (!context) {
    throw new Error('useMediaUploadService must be used within MediaUploadServiceProvider')
  }
  return context
}

const ServiceUploadUrlMap = new Map<string, string | undefined>()

export function MediaUploadServiceProvider({ children }: { children: React.ReactNode }) {
  const { signHttpAuth } = useNostr()
  const [service, setService] = useState(storage.getMediaUploadService())

  const updateService = (newService: string) => {
    setService(newService)
    storage.setMediaUploadService(newService)
  }

  const upload = async (file: File) => {
    let uploadUrl = ServiceUploadUrlMap.get(service)
    if (!uploadUrl) {
      const response = await fetch(`${service}/.well-known/nostr/nip96.json`)
      if (!response.ok) {
        throw new Error(
          `${simplifyUrl(service)} does not work, please try another service in your settings`
        )
      }
      const data = await response.json()
      uploadUrl = data?.api_url
      if (!uploadUrl) {
        throw new Error(
          `${simplifyUrl(service)} does not work, please try another service in your settings`
        )
      }
      ServiceUploadUrlMap.set(service, uploadUrl)
    }

    const formData = new FormData()
    formData.append('file', file)

    const auth = await signHttpAuth(uploadUrl, 'POST')
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: auth
      }
    })

    if (!response.ok) {
      throw new Error(response.status.toString())
    }

    const data = await response.json()
    const tags = z.array(z.array(z.string())).parse(data.nip94_event?.tags ?? [])
    const imageUrl = tags.find(([tagName]) => tagName === 'url')?.[1]
    if (imageUrl) {
      return { url: imageUrl, tags }
    } else {
      throw new Error('No image url found')
    }
  }

  return (
    <MediaUploadServiceContext.Provider value={{ service, updateService, upload }}>
      {children}
    </MediaUploadServiceContext.Provider>
  )
}
