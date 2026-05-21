import { getHashFromURL } from 'blossom-client-sdk'

const LOCAL_CACHE_HOSTNAME = '127.0.0.1'
const LOCAL_CACHE_ORIGIN = `http://${LOCAL_CACHE_HOSTNAME}:24242`
const PROBE_TIMEOUT_MS = 1000

class LocalBlossomCacheService {
  static instance: LocalBlossomCacheService
  private _available = false
  private initPromise: Promise<void> | null = null

  constructor() {
    if (!LocalBlossomCacheService.instance) {
      LocalBlossomCacheService.instance = this
    }
    return LocalBlossomCacheService.instance
  }

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.probe()
    }
    return this.initPromise
  }

  get available() {
    return this._available
  }

  get hostname() {
    return LOCAL_CACHE_HOSTNAME
  }

  markUnavailable() {
    this._available = false
  }

  rewriteUrl(originalUrl: string, pubkey?: string): string | null {
    if (!this._available) return null
    let url: URL
    try {
      url = new URL(originalUrl)
    } catch {
      return null
    }
    if (url.hostname === LOCAL_CACHE_HOSTNAME) return null
    const hash = getHashFromURL(url)
    if (!hash) return null

    const ext = url.pathname.match(/\.\w+$/i)?.[0] ?? ''
    const local = new URL(`${LOCAL_CACHE_ORIGIN}/${hash}${ext}`)
    local.searchParams.set('xs', url.origin)
    if (pubkey) local.searchParams.set('as', pubkey)
    return local.toString()
  }

  private async probe(): Promise<void> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetch(`${LOCAL_CACHE_ORIGIN}/`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      })
      this._available = res.ok
      if (this._available) {
        console.log('[local-blossom-cache] detected at', LOCAL_CACHE_ORIGIN)
      }
    } catch {
      this._available = false
    } finally {
      clearTimeout(timer)
    }
  }
}

const instance = new LocalBlossomCacheService()
export default instance
