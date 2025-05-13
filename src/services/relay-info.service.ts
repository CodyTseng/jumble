import { MONITOR, MONITOR_RELAYS } from '@/constants'
import { tagNameEquals } from '@/lib/tag'
import { isWebsocketUrl, simplifyUrl } from '@/lib/url'
import { TNip66RelayInfo, TRelayInfo } from '@/types'
import DataLoader from 'dataloader'
import FlexSearch from 'flexsearch'
import { Event } from 'nostr-tools'
import client from './client.service'
import indexedDb from './indexed-db.service'

class RelayInfoService {
  static instance: RelayInfoService

  public static getInstance(): RelayInfoService {
    if (!RelayInfoService.instance) {
      RelayInfoService.instance = new RelayInfoService()
      RelayInfoService.instance.init()
    }
    return RelayInfoService.instance
  }

  private initPromise: Promise<void> | null = null

  private relayInfoMap = new Map<string, TNip66RelayInfo>()
  private relayInfoIndex = new FlexSearch.Index({
    tokenize: 'forward',
    encode: (str) =>
      str
        // eslint-disable-next-line no-control-regex
        .replace(/[^\x00-\x7F]/g, (match) => ` ${match} `)
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
  })
  private fetchDataloader = new DataLoader<string, TNip66RelayInfo | undefined>(
    (urls) => Promise.all(urls.map((url) => this._getRelayInfo(url))),
    { maxBatchSize: 1 }
  )
  private relayUrlsForRandom: string[] = []

  async init() {
    if (!this.initPromise) {
      this.initPromise = this.loadRelayInfos()
    }
    await this.initPromise
  }

  async search(query: string) {
    if (this.initPromise) {
      await this.initPromise
    }

    if (!query) {
      const arr = Array.from(this.relayInfoMap.values())
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    const result = await this.relayInfoIndex.searchAsync(query)
    return result
      .map((url) => this.relayInfoMap.get(url as string))
      .filter(Boolean) as TNip66RelayInfo[]
  }

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

  async getRandomRelayInfos(count: number) {
    if (this.initPromise) {
      await this.initPromise
    }

    const relayInfos: TNip66RelayInfo[] = []
    while (relayInfos.length < count) {
      const randomIndex = Math.floor(Math.random() * this.relayUrlsForRandom.length)
      const url = this.relayUrlsForRandom[randomIndex]
      this.relayUrlsForRandom.splice(randomIndex, 1)
      if (this.relayUrlsForRandom.length === 0) {
        this.relayUrlsForRandom = Array.from(this.relayInfoMap.keys())
      }

      const relayInfo = this.relayInfoMap.get(url)
      if (relayInfo) {
        relayInfos.push(relayInfo)
      }
    }
    return relayInfos
  }

  private async _getRelayInfo(url: string) {
    const exist = this.relayInfoMap.get(url)
    if (exist && (exist.hasNip11 || exist.triedNip11)) {
      return exist
    }

    const nip11 = await this.fetchRelayInfoByNip11(url)
    const relayInfo = nip11
      ? {
          ...nip11,
          url,
          shortUrl: simplifyUrl(url),
          hasNip11: Object.keys(nip11).length > 0,
          triedNip11: true
        }
      : {
          url,
          shortUrl: simplifyUrl(url),
          hasNip11: false,
          triedNip11: true
        }
    return await this.addRelayInfo(relayInfo)
  }

  private async fetchRelayInfoByNip11(url: string) {
    try {
      const res = await fetch(url.replace('ws://', 'http://').replace('wss://', 'https://'), {
        headers: { Accept: 'application/nostr+json' }
      })
      return res.json() as TRelayInfo
    } catch {
      return undefined
    }
  }

  private async loadRelayInfos() {
    const localRelayInfos = await indexedDb.getAllRelayInfoEvents()
    const relayInfos = formatRelayInfoEvents(localRelayInfos)
    relayInfos.forEach((relayInfo) => this.addRelayInfo(relayInfo))
    this.relayUrlsForRandom = Array.from(this.relayInfoMap.keys())

    const loadFromInternet = async (slowFetch: boolean = true) => {
      let until: number = Math.round(Date.now() / 1000)
      const since = until - 60 * 60 * 48

      while (until) {
        const relayInfoEvents = await client.fetchEvents(MONITOR_RELAYS, {
          authors: [MONITOR],
          kinds: [30166],
          since,
          until,
          limit: slowFetch ? 100 : 1000
        })
        const events = relayInfoEvents.sort((a, b) => b.created_at - a.created_at)
        if (events.length === 0) {
          break
        }
        for (const event of events) {
          await indexedDb.putRelayInfoEvent(event)
          const relayInfo = formatRelayInfoEvents([event])[0]
          await this.addRelayInfo(relayInfo)
        }
        until = events[events.length - 1].created_at - 1
        if (slowFetch) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
      this.relayUrlsForRandom = Array.from(this.relayInfoMap.keys())
    }
    if (localRelayInfos.length === 0) {
      await loadFromInternet(false)
    } else {
      setTimeout(loadFromInternet, 1000 * 20) // 20 seconds
    }
  }

  private async addRelayInfo(relayInfo: TNip66RelayInfo) {
    const oldRelayInfo = this.relayInfoMap.get(relayInfo.url)
    const newRelayInfo = oldRelayInfo
      ? {
          ...oldRelayInfo,
          ...relayInfo,
          hasNip11: oldRelayInfo.hasNip11 || relayInfo.hasNip11,
          triedNip11: oldRelayInfo.triedNip11 || relayInfo.triedNip11
        }
      : relayInfo

    if (!Array.isArray(newRelayInfo.supported_nips)) {
      newRelayInfo.supported_nips = []
    }

    this.relayInfoMap.set(newRelayInfo.url, newRelayInfo)
    await this.relayInfoIndex.addAsync(
      newRelayInfo.url,
      [
        newRelayInfo.shortUrl,
        ...newRelayInfo.shortUrl.split('.'),
        newRelayInfo.name ?? '',
        newRelayInfo.description ?? ''
      ].join(' ')
    )
    return newRelayInfo
  }
}

const instance = RelayInfoService.getInstance()
export default instance

function formatRelayInfoEvents(relayInfoEvents: Event[]) {
  const urlSet = new Set<string>()
  const relayInfos: TNip66RelayInfo[] = []
  relayInfoEvents.forEach((event) => {
    try {
      const url = event.tags.find(tagNameEquals('d'))?.[1]
      if (!url || urlSet.has(url) || !isWebsocketUrl(url)) {
        return
      }

      urlSet.add(url)
      const basicInfo = event.content ? (JSON.parse(event.content) as TRelayInfo) : {}
      const tagInfo: Omit<TNip66RelayInfo, 'url' | 'shortUrl'> = {
        hasNip11: Object.keys(basicInfo).length > 0,
        triedNip11: false
      }
      event.tags.forEach((tag) => {
        if (tag[0] === 'T') {
          tagInfo.relayType = tag[1]
        } else if (tag[0] === 'g' && tag[2] === 'countryCode') {
          tagInfo.countryCode = tag[1]
        }
      })
      relayInfos.push({
        ...basicInfo,
        ...tagInfo,
        url,
        shortUrl: simplifyUrl(url)
      })
    } catch (error) {
      console.error(error)
    }
  })
  return relayInfos
}
