import { BoundedMap } from '@/lib/bounded-map'
import { proxyFetch } from '@/lib/proxy-fetch'
import { TWebMetadata } from '@/types'
import DataLoader from 'dataloader'

class WebService {
  static instance: WebService

  private webMetadataDataLoader = new DataLoader<string, TWebMetadata>(
    async (keys) => {
      return await Promise.all(
        keys.map((key) => {
          const { requestUrl, sourceUrl } = JSON.parse(key) as {
            requestUrl: string
            sourceUrl: string
          }
          return this.fetchOne(requestUrl, sourceUrl)
        })
      )
    },
    {
      maxBatchSize: 1,
      cacheMap: new BoundedMap<string, Promise<TWebMetadata>>({ maxSize: 1_000 })
    }
  )

  constructor() {
    if (!WebService.instance) {
      WebService.instance = this
    }
    return WebService.instance
  }

  async fetchWebMetadata(requestUrl: string, sourceUrl = requestUrl) {
    return await this.webMetadataDataLoader.load(JSON.stringify({ requestUrl, sourceUrl }))
  }

  private async fetchOne(requestUrl: string, sourceUrl: string): Promise<TWebMetadata> {
    try {
      const res = await proxyFetch(requestUrl, {
        headers: { accept: 'text/html,application/xhtml+xml' }
      })
      if (!res.ok) return {}
      const ct = res.headers['content-type'] ?? ''
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return {}
      const html = res.body
      if (!html) return {}

      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const title = (
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
        doc.querySelector('title')?.textContent
      )?.trim()
      const description = (
        doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
        (doc.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content
      )?.trim()
      const rawImage = (
        (doc.querySelector('meta[property="og:image"]') as HTMLMetaElement | null)?.content ||
        (doc.querySelector('meta[property="og:image:secure_url"]') as HTMLMetaElement | null)
          ?.content ||
        (doc.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null)?.content
      )?.trim()
      const documentUrl = requestUrl === sourceUrl ? res.url || sourceUrl : sourceUrl
      const image = resolveHttpUrl(rawImage, documentUrl)

      return { title, description, image }
    } catch {
      return {}
    }
  }
}

function resolveHttpUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined

  try {
    const resolved = new URL(value, baseUrl)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined
    return resolved.toString()
  } catch {
    return undefined
  }
}

const instance = new WebService()

export default instance
