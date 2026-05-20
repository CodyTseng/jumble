import { proxyFetch } from '@/lib/proxy-fetch'

const KLIPY_BASE_URL = 'https://api.klipy.com/api/v1'
const DEFAULT_LIMIT = 24

export type TGif = {
  id: string
  /** KLIPY slug — also used to register share with /klipy/register-share */
  slug: string
  description: string
  /** Full-size GIF URL inserted into the post. */
  url: string
  /** Small GIF URL for picker thumbnails. */
  previewUrl: string
  width: number
  height: number
}

export type TGifFetchResult = {
  items: TGif[]
  /** Next page number, or undefined if no more pages. */
  nextPage?: number
}

type KlipyMediaFormat = {
  url?: string
  width?: number
  height?: number
}

type KlipyMediaVariant = {
  gif?: KlipyMediaFormat
  webp?: KlipyMediaFormat
  mp4?: KlipyMediaFormat
}

type KlipyMediaSizes = {
  hd?: KlipyMediaVariant
  md?: KlipyMediaVariant
  sm?: KlipyMediaVariant
  xs?: KlipyMediaVariant
}

type KlipyGifItem = {
  id: number | string
  slug?: string
  title?: string
  /** Real responses use `file` (singular). Docs sometimes show `files` (plural) — accept both. */
  file?: KlipyMediaSizes
  files?: KlipyMediaSizes
}

type KlipyApiResponse = {
  result: boolean
  data?: {
    data: KlipyGifItem[]
    current_page?: number
    per_page?: number
    has_next?: boolean
  }
}

class KlipyService {
  static instance: KlipyService
  private readonly apiKey: string

  constructor() {
    if (!KlipyService.instance) {
      KlipyService.instance = this
    }
    this.apiKey = import.meta.env.VITE_KLIPY_API_KEY ?? ''
    return KlipyService.instance
  }

  isEnabled(): boolean {
    return this.apiKey.length > 0
  }

  async trending(options?: {
    limit?: number
    page?: number
    locale?: string
  }): Promise<TGifFetchResult> {
    return this.request('trending', options)
  }

  async search(
    query: string,
    options?: { limit?: number; page?: number; locale?: string }
  ): Promise<TGifFetchResult> {
    if (!query.trim()) return { items: [] }
    return this.request('search', { ...options, q: query })
  }

  private async request(
    endpoint: 'trending' | 'search',
    options?: { limit?: number; page?: number; locale?: string; q?: string }
  ): Promise<TGifFetchResult> {
    if (!this.isEnabled()) return { items: [] }

    const params = new URLSearchParams({
      per_page: String(Math.min(50, Math.max(8, options?.limit ?? DEFAULT_LIMIT))),
      rating: 'pg-13'
    })
    if (options?.page && options.page > 1) params.set('page', String(options.page))
    if (options?.locale) params.set('locale', this.normalizeLocale(options.locale))
    if (options?.q) params.set('q', options.q)

    const url = `${KLIPY_BASE_URL}/${encodeURIComponent(this.apiKey)}/gifs/${endpoint}?${params.toString()}`
    const res = await proxyFetch(url, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok || !res.body) return { items: [] }

    let parsed: KlipyApiResponse
    try {
      parsed = JSON.parse(res.body)
    } catch {
      return { items: [] }
    }
    if (!parsed.result || !parsed.data) return { items: [] }

    const currentPage = parsed.data.current_page ?? options?.page ?? 1
    const items = parsed.data.data
      .map((r) => this.normalize(r))
      .filter((g): g is TGif => !!g)
    return {
      items,
      nextPage: parsed.data.has_next ? currentPage + 1 : undefined
    }
  }

  private normalize(raw: KlipyGifItem): TGif | null {
    const sizes = raw.file ?? raw.files
    const full = sizes?.hd?.gif ?? sizes?.md?.gif ?? sizes?.sm?.gif
    const preview = sizes?.sm?.gif ?? sizes?.xs?.gif ?? sizes?.md?.gif ?? full
    if (!full?.url || !preview?.url) return null
    return {
      id: String(raw.id),
      slug: raw.slug ?? String(raw.id),
      description: raw.title ?? '',
      url: full.url,
      previewUrl: preview.url,
      width: full.width ?? 0,
      height: full.height ?? 0
    }
  }

  /** KLIPY expects locales like `en_US`. i18n gives us `en`, `zh`, `pt-BR`. */
  private normalizeLocale(locale: string): string {
    const [base, region] = locale.replace('_', '-').split('-')
    if (!base) return 'en_US'
    return region ? `${base}_${region.toUpperCase()}` : `${base}_${base.toUpperCase()}`
  }
}

const instance = new KlipyService()
export default instance
