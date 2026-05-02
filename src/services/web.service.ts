import { TWebMetadata } from '@/types'
import DataLoader from 'dataloader'

class WebService {
  static instance: WebService

  private webMetadataDataLoader = new DataLoader<string, TWebMetadata>(
    async (urls) => {
      return await Promise.all(urls.map((url) => this.fetchOne(url)))
    },
    { maxBatchSize: 1 }
  )

  constructor() {
    if (!WebService.instance) {
      WebService.instance = this
    }
    return WebService.instance
  }

  async fetchWebMetadata(url: string) {
    return await this.webMetadataDataLoader.load(url)
  }

  private async fetchOne(url: string): Promise<TWebMetadata> {
    try {
      const res = await fetch(url, { headers: { accept: 'text/html,application/xhtml+xml' } })
      if (!res.ok) return {}
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return {}
      const html = await res.text()
      if (!html) return {}

      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const title =
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        doc.querySelector('title')?.textContent
      const description =
        doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        (doc.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content
      const image = (doc.querySelector('meta[property="og:image"]') as HTMLMetaElement | null)
        ?.content

      return { title, description, image }
    } catch {
      return {}
    }
  }
}

const instance = new WebService()

export default instance
