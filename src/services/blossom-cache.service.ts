import storage from '@/services/local-storage.service'
import { getHashFromURL } from 'blossom-client-sdk'

const PROBE_TIMEOUT_MS = 3000

class BlossomCacheService {
  static instance: BlossomCacheService
  // Session flag: whether the configured server has been verified reachable.
  // We never rewrite resource URLs to an unverified server, so a previously
  // enabled but currently-down server won't make every resource hit it first.
  private reachable = false

  constructor() {
    if (!BlossomCacheService.instance) {
      BlossomCacheService.instance = this
    }
    return BlossomCacheService.instance
  }

  // Called once at startup (non-blocking). Re-verifies a previously enabled
  // server in the background before any resource URL is rewritten through it.
  async init(): Promise<void> {
    if (!this.enabled) return
    this.reachable = await this.probe()
  }

  // Verify the server is reachable, then persist and enable it for this session.
  async enable(serverUrl: string): Promise<boolean> {
    const reachable = await this.probe(serverUrl)
    if (!reachable) return false
    this.reachable = true
    storage.setBlossomCacheServerUrl(serverUrl)
    storage.setBlossomCacheServerEnabled(true)
    return true
  }

  disable() {
    this.reachable = false
    storage.setBlossomCacheServerEnabled(false)
  }

  get enabled() {
    return storage.getBlossomCacheServerEnabled()
  }

  get serverUrl() {
    return storage.getBlossomCacheServerUrl()
  }

  private get origin(): string | null {
    try {
      return new URL(this.serverUrl).origin
    } catch {
      return null
    }
  }

  get hostname(): string | null {
    try {
      return new URL(this.serverUrl).hostname
    } catch {
      return null
    }
  }

  get available() {
    return this.enabled && this.reachable && !!this.origin
  }

  rewriteUrl(originalUrl: string, pubkey?: string): string | null {
    if (!this.available) return null
    const origin = this.origin
    if (!origin) return null
    let url: URL
    try {
      url = new URL(originalUrl)
    } catch {
      return null
    }
    if (url.origin === origin) return null
    const hash = getHashFromURL(url)
    if (!hash) return null

    const ext = url.pathname.match(/\.\w+$/i)?.[0] ?? ''
    const local = new URL(`${origin}/${hash}${ext}`)
    local.searchParams.set('xs', url.origin)
    if (pubkey) local.searchParams.set('as', pubkey)
    return local.toString()
  }

  // Reachability check used at startup and before enabling in settings.
  async probe(serverUrl?: string): Promise<boolean> {
    let origin: string
    try {
      origin = new URL(serverUrl ?? this.serverUrl).origin
    } catch {
      return false
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      await fetch(`${origin}/`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      })
      return true
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }
}

const instance = new BlossomCacheService()
export default instance
