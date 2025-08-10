import { simplifyUrl } from '@/lib/url'
import { TDraftEvent, TMediaUploadServiceConfig } from '@/types'
import { BlossomClient } from 'blossom-client-sdk'
import { z } from 'zod'
import client from './client.service'
import storage from './local-storage.service'

type UploadOptions = {
  onProgress?: (progressPercent: number) => void
  signal?: AbortSignal
}

class MediaUploadService {
  static instance: MediaUploadService

  private serviceConfig: TMediaUploadServiceConfig = storage.getMediaUploadServiceConfig()
  private nip96ServiceUploadUrlMap = new Map<string, string | undefined>()
  private imetaTagMap = new Map<string, string[]>()

  constructor() {
    if (!MediaUploadService.instance) {
      MediaUploadService.instance = this
    }
    return MediaUploadService.instance
  }

  setServiceConfig(config: TMediaUploadServiceConfig) {
    this.serviceConfig = config
  }

  async upload(file: File, options?: UploadOptions) {
    let result: { url: string; tags: string[][] }
    if (this.serviceConfig.type === 'nip96') {
      result = await this.uploadByNip96(this.serviceConfig.service, file, options)
    } else {
      result = await this.uploadByBlossom(file, options)
    }

    if (result.tags.length > 0) {
      this.imetaTagMap.set(result.url, ['imeta', ...result.tags.map(([n, v]) => `${n} ${v}`)])
    }
    return result
  }

  private async uploadByBlossom(file: File, options?: UploadOptions) {
    const pubkey = client.pubkey
    const signer = async (draft: TDraftEvent) => {
      if (!client.signer) {
        throw new Error('You need to be logged in to upload media')
      }
      return client.signer.signEvent(draft)
    }
    if (!pubkey) {
      throw new Error('You need to be logged in to upload media')
    }

    if (options?.signal?.aborted) {
      throw new Error('Upload aborted')
    }

    options?.onProgress?.(0)

    const servers = await client.fetchBlossomServerList(pubkey)
    if (servers.length === 0) {
      throw new Error('No Blossom services available')
    }
    const [mainServer, ...mirrorServers] = servers

    const auth = await BlossomClient.createUploadAuth(signer, file, {
      message: 'Uploading media file'
    })

    // first upload blob to main server
    const blob = await BlossomClient.uploadBlob(mainServer, file, { auth })

    if (mirrorServers.length > 0) {
      await Promise.allSettled(
        mirrorServers.map((server) => BlossomClient.mirrorBlob(server, blob, { auth }))
      )
    }

    let tags: string[][] = []
    const parseResult = z.array(z.array(z.string())).safeParse((blob as any).nip94 ?? [])
    if (parseResult.success) {
      tags = parseResult.data
    }

    options?.onProgress?.(100)
    return { url: blob.url, tags }
  }

  private async uploadByNip96(service: string, file: File, options?: UploadOptions) {
    let uploadUrl = this.nip96ServiceUploadUrlMap.get(service)
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
      this.nip96ServiceUploadUrlMap.set(service, uploadUrl)
    }

    const formData = new FormData()
    formData.append('file', file)

    const auth = await client.signHttpAuth(uploadUrl, 'POST', 'Uploading media file')

    // Use XMLHttpRequest for upload progress support
    const result = await new Promise<{ url: string; tags: string[][] }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl as string)
      xhr.responseType = 'json'
      xhr.setRequestHeader('Authorization', auth)

      const handleAbort = () => {
        try {
          xhr.abort()
        } catch (_) {
          // ignore
        }
        reject(new Error('Upload aborted'))
      }
      if (options?.signal) {
        if (options.signal.aborted) {
          return handleAbort()
        }
        options.signal.addEventListener('abort', handleAbort, { once: true })
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          options?.onProgress?.(percent)
        }
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = xhr.response
          try {
            const tags = z.array(z.array(z.string())).parse(data?.nip94_event?.tags ?? [])
            const url = tags.find(([tagName]: string[]) => tagName === 'url')?.[1]
            if (url) {
              resolve({ url, tags })
            } else {
              reject(new Error('No url found'))
            }
          } catch (e) {
            reject(e as Error)
          }
        } else {
          reject(new Error(xhr.status.toString() + ' ' + xhr.statusText))
        }
      }
      xhr.send(formData)
    })

    return result
  }

  getImetaTagByUrl(url: string) {
    return this.imetaTagMap.get(url)
  }
}

const instance = new MediaUploadService()
export default instance
