import { simplifyUrl } from '@/lib/url'
import indexDb from '@/services/indexed-db.service'
import { TAwesomeRelayCollection, TRelayInfo } from '@/types'
import DataLoader from 'dataloader'

class RelayInfoService {
  static instance: RelayInfoService

  public static getInstance(): RelayInfoService {
    if (!RelayInfoService.instance) {
      RelayInfoService.instance = new RelayInfoService()
    }
    return RelayInfoService.instance
  }

  private awesomeRelayCollections: Promise<TAwesomeRelayCollection[]> | null = null
  private fetchDataloader = new DataLoader<string, TRelayInfo | undefined>(
    async (urls) => {
      const results = await Promise.allSettled(urls.map((url) => this._getRelayInfo(url)))
      return results.map((res) => (res.status === 'fulfilled' ? res.value : undefined))
    },
    { maxBatchSize: 1 }
  )

  async getRelayInfos(urls: string[]) {
    if (urls.length === 0) {
      return []
    }
    const relayInfos = await this.fetchDataloader.loadMany(urls)
    return relayInfos.map((relayInfo) => (relayInfo instanceof Error ? undefined : relayInfo))
  }

  async getRelayInfo(url: string) {
    return this.fetchDataloader.load(url)
  }

  async getAwesomeRelayCollections() {
    if (this.awesomeRelayCollections) return this.awesomeRelayCollections

    this.awesomeRelayCollections = (async () => {
      try {
        const res = await fetch(
          'https://raw.githubusercontent.com/CodyTseng/awesome-nostr-relays/master/dist/collections.json'
        )
        if (!res.ok) {
          throw new Error('Failed to fetch awesome relay collections')
        }
        const data = (await res.json()) as { collections: TAwesomeRelayCollection[] }
        return data.collections
      } catch (error) {
        console.error('Error fetching awesome relay collections:', error)
        return []
      }
    })()

    return this.awesomeRelayCollections
  }

  private async _getRelayInfo(url: string) {
    const fetchRelayInfo = async (background: boolean) => {
      const nip11 = await this.fetchRelayNip11(url)
      const relayInfo = {
        ...(nip11 ?? {}),
        url,
        shortUrl: simplifyUrl(url)
      }

      if (!Array.isArray(relayInfo.supported_nips)) {
        relayInfo.supported_nips = []
      }

      await indexDb.putRelayInfo(relayInfo)

      if (background) {
        this.fetchDataloader.clear(url)
        this.fetchDataloader.prime(url, relayInfo)
      }

      return relayInfo
    }

    const storedRelayInfo = await indexDb.getRelayInfo(url)
    if (storedRelayInfo) {
      fetchRelayInfo(true) // Update in background
      return storedRelayInfo
    }

    return fetchRelayInfo(false)
  }

  private async fetchRelayNip11(url: string) {
    try {
      const res = await fetch(url.replace('ws://', 'http://').replace('wss://', 'https://'), {
        headers: { Accept: 'application/nostr+json' }
      })
      return res.json() as Omit<TRelayInfo, 'url' | 'shortUrl'>
    } catch {
      return undefined
    }
  }
}

const instance = RelayInfoService.getInstance()
export default instance
