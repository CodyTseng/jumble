import { MONITOR, MONITOR_RELAYS } from '@/constants'
import { tagNameEquals } from '@/lib/tag'
import { isWebsocketUrl, simplifyUrl } from '@/lib/url'
import { TNip66RelayInfo, TRelayInfo } from '@/types'
import DataLoader from 'dataloader'
import FlexSearch from 'flexsearch'
import { Event } from 'nostr-tools'
import client from './client.service'

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
    {
      cache: false
    }
  )

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
      return Array.from(this.relayInfoMap.values())
    }

    const result = await this.relayInfoIndex.searchAsync(query)
    return result
      .map((url) => this.relayInfoMap.get(url as string))
      .filter(Boolean) as TNip66RelayInfo[]
  }

  async getRelayInfos(urls: string[]) {
    const relayInfos = await this.fetchDataloader.loadMany(urls)
    return relayInfos.map((relayInfo) => (relayInfo instanceof Error ? undefined : relayInfo))
  }

  async getRelayInfo(url: string) {
    return this.fetchDataloader.load(url)
  }

  private async _getRelayInfo(url: string) {
    const exist = this.relayInfoMap.get(url)
    if (exist) {
      return exist
    }

    try {
      const res = await fetch(url.replace('ws://', 'http://').replace('wss://', 'https://'), {
        headers: { Accept: 'application/nostr+json' }
      })
      const relayInfo = res.json() as TRelayInfo
      await this.addRelayInfo({ ...relayInfo, url, shortUrl: simplifyUrl(url) })
    } catch {
      return undefined
    }
  }

  private async loadRelayInfos() {
    let until: number = Math.round(Date.now() / 1000)
    const since = until - 60 * 60 * 24

    while (until) {
      const relayInfoEvents = await client.fetchEvents(MONITOR_RELAYS, {
        authors: [MONITOR],
        kinds: [30166],
        since,
        until,
        limit: 1000
      })
      const events = relayInfoEvents.sort((a, b) => b.created_at - a.created_at)
      if (events.length === 0) {
        break
      }
      until = events[events.length - 1].created_at - 1
      const relayInfos = formatRelayInfoEvents(events)
      for (const relayInfo of relayInfos) {
        await this.addRelayInfo(relayInfo)
      }
    }
  }

  private async addRelayInfo(relayInfo: TNip66RelayInfo) {
    this.relayInfoMap.set(relayInfo.url, relayInfo)
    await this.relayInfoIndex.addAsync(
      relayInfo.url,
      [relayInfo.shortUrl, relayInfo.name ?? '', relayInfo.description ?? ''].join(' ')
    )
  }
}

const instance = RelayInfoService.getInstance()
export default instance

function formatRelayInfoEvents(relayInfoEvents: Event[]) {
  const urlSet = new Set<string>()
  const relayInfos: TNip66RelayInfo[] = []
  relayInfoEvents.forEach((event) => {
    const url = event.tags.find(tagNameEquals('d'))?.[1]
    if (!url || urlSet.has(url) || !isWebsocketUrl(url)) {
      return
    }

    urlSet.add(url)
    const basicInfo = event.content ? (JSON.parse(event.content) as TRelayInfo) : {}
    const tagInfo: Omit<TNip66RelayInfo, 'url' | 'shortUrl'> = {}
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
  })
  return relayInfos
}
