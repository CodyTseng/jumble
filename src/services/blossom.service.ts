import blossomCache from '@/services/blossom-cache.service'
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
      url: string
      validUrl?: string
    }
  >()

  constructor() {
    if (!BlossomService.instance) {
      BlossomService.instance = this
    }
    return BlossomService.instance
  }

  peekValidUrl(url: string, pubkey: string): string {
    const cache = this.cacheMap.get(url)
    if (cache?.validUrl) {
      return cache.validUrl
    }
    const localUrl = blossomCache.rewriteUrl(url, pubkey)
    return localUrl ?? url
  }

  async getValidUrl(url: string, pubkey: string): Promise<string> {
    const cache = this.cacheMap.get(url)
    if (cache) {
      return cache.validUrl ?? cache.url
    }

    let resolveFunc: (url: string) => void
    const promise = new Promise<string>((resolve) => {
      resolveFunc = resolve
    })
    const tried = new Set<string>()

    const localUrl = blossomCache.rewriteUrl(url, pubkey)
    if (localUrl) {
      this.cacheMap.set(url, { pubkey, resolve: resolveFunc!, promise, tried, url: localUrl })
      const cacheHostname = blossomCache.hostname
      if (cacheHostname) {
        tried.add(cacheHostname)
      }
      return localUrl
    }

    this.cacheMap.set(url, { pubkey, resolve: resolveFunc!, promise, tried, url })
    try {
      const u = new URL(url)
      tried.add(u.hostname)
    } catch {
      // ignore
    }
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

    if (oldImageUrl && !tried.has(oldImageUrl.hostname)) {
      tried.add(oldImageUrl.hostname)
      return originalUrl
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
        url: successUrl,
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
