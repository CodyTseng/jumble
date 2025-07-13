import { simplifyUrl } from '@/lib/url'
import { TMediaUploadServiceConfig } from '@/types'
import { BlossomClient, Signer } from 'blossom-client-sdk'
import dayjs from 'dayjs'
import { kinds } from 'nostr-tools'
import { z } from 'zod'
import client from './client.service'
import storage from './local-storage.service'

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

  async upload(file: File) {
    if (this.serviceConfig.type === 'nip96') {
      return this.uploadByNip96(this.serviceConfig.service, file)
    }

    return this.uploadByBlossom(file)
  }

  private async uploadByBlossom(file: File) {
    const pubkey = client.pubkey
    const signer = client.signer as Signer | undefined
    if (!pubkey || !signer) {
      throw new Error('You need to be logged in to upload media')
    }

    const servers = await client.fetchBlossomServerList(pubkey)
    if (servers.length === 0) {
      throw new Error('No Blossom services available')
    }
    const [mainServer, ...mirrorServers] = servers

    const auth = await BlossomClient.createUploadAuth(signer, file, {
      message: `Uploading ${file.name}`
    })

    // first upload blob to main server
    const blob = await BlossomClient.uploadBlob(mainServer, file, { auth })

    if (mirrorServers.length > 0) {
      await Promise.allSettled(
        mirrorServers.map((server) => BlossomClient.mirrorBlob(server, blob, { auth }))
      )
    }

    // TODO: tags
    return { url: blob.url, tags: [] as string[][] }
  }

  private async uploadByNip96(service: string, file: File) {
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

    const auth = await this.signHttpAuth(uploadUrl, 'POST')
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: auth
      }
    })

    if (!response.ok) {
      throw new Error(response.status.toString() + ' ' + response.statusText)
    }

    const data = await response.json()
    const tags = z.array(z.array(z.string())).parse(data.nip94_event?.tags ?? [])
    const url = tags.find(([tagName]) => tagName === 'url')?.[1]
    if (url) {
      this.imetaTagMap.set(url, ['imeta', ...tags.map(([n, v]) => `${n} ${v}`)])
      return { url: url, tags }
    } else {
      throw new Error('No url found')
    }
  }

  getImetaTagByUrl(url: string) {
    return this.imetaTagMap.get(url)
  }

  async signHttpAuth(url: string, method: string) {
    if (!client.signer) {
      throw new Error('No signer found')
    }
    const event = await client.signer.signEvent({
      content: '',
      kind: kinds.HTTPAuth,
      created_at: dayjs().unix(),
      tags: [
        ['u', url],
        ['method', method]
      ]
    })
    return 'Nostr ' + btoa(JSON.stringify(event))
  }
}

const instance = new MediaUploadService()
export default instance
