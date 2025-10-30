import client from '@/services/client.service'
import { getHashFromURL } from 'blossom-client-sdk'

class BlossomService {
  static instance: BlossomService
  private cacheMap = new Map<
    string,
    {
      pubkey?: string
      resolve: (url: string) => void
      promise: Promise<string>
      tried: Set<string>
      validUrl?: string
    }
  >()

  constructor() {
    if (!BlossomService.instance) {
      BlossomService.instance = this
    }
    return BlossomService.instance
  }

  async getValidUrl(url: string, pubkey: string): Promise<string> {
    const cache = this.cacheMap.get(url)
    if (cache) {
      return cache.validUrl ?? cache.promise
    }

    let resolveFunc: (url: string) => void
    const promise = new Promise<string>((resolve) => {
      resolveFunc = resolve
    })
    const tried = new Set<string>()
    this.cacheMap.set(url, { pubkey, resolve: resolveFunc!, promise, tried })

    return url
  }

  async tryNextUrl(originalUrl: string): Promise<string | null> {
    const entry = this.cacheMap.get(originalUrl)
    if (!entry) {
      return null
    }

    if (entry.validUrl) {
      return entry.validUrl
    }

    const { pubkey, tried, resolve } = entry
    let oldImageUrl: URL | undefined
    let hash: string | null = null
    try {
      oldImageUrl = new URL(originalUrl)
      hash = getHashFromURL(oldImageUrl)
    } catch (error) {
      console.error('Invalid image URL:', error)
    }
    if (!pubkey || !hash || !oldImageUrl) {
      resolve(originalUrl)
      return null
    }

    const ext = oldImageUrl.pathname.match(/\.\w+$/i)

    const blossomServerList = await client.fetchBlossomServerList(pubkey)
    const urls = blossomServerList
      .map((server) => {
        try {
          return new URL(server)
        } catch (error) {
          console.error('Invalid Blossom server URL:', server, error)
          return undefined
        }
      })
      .filter((url) => !!url && !tried.has(url.hostname))
    const nextUrl = urls[0]
    if (!nextUrl) {
      resolve(originalUrl)
      return null
    }

    tried.add(nextUrl.hostname)
    nextUrl.pathname = '/' + hash + ext
    return nextUrl.toString()
  }

  markAsSuccess(originalUrl: string, successUrl: string) {
    const entry = this.cacheMap.get(originalUrl)
    if (!entry) {
      this.cacheMap.set(originalUrl, {
        resolve: () => {},
        promise: Promise.resolve(successUrl),
        tried: new Set<string>(),
        validUrl: successUrl
      })
      return
    }

    entry.resolve(successUrl)
    entry.validUrl = successUrl
  }
}

const instance = new BlossomService()
export default instance
