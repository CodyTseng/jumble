import { TRelayGroup } from '@common/types'
import { formatPubkey } from '@renderer/lib/pubkey'
import { tagNameEquals } from '@renderer/lib/tag'
import { TProfile, TRelayList } from '@renderer/types'
import DataLoader from 'dataloader'
import { LRUCache } from 'lru-cache'
import { Filter, kinds, Event as NEvent, SimplePool } from 'nostr-tools'
import { EVENT_TYPES, eventBus } from './event-bus.service'
import storage from './storage.service'
import { isWebsocketUrl, normalizeUrl } from '@renderer/lib/url'

const BIG_RELAY_URLS = [
  'wss://relay.damus.io/',
  'wss://nos.lol/',
  'wss://relay.nostr.band/',
  'wss://relay.noswhere.com/'
]

class ClientService {
  static instance: ClientService

  private pool = new SimplePool()
  private relayUrls: string[] = BIG_RELAY_URLS
  private initPromise!: Promise<void>

  private eventCache = new LRUCache<string, Promise<NEvent | undefined>>({
    max: 10000,
    fetchMethod: async (filterStr) => {
      const [event] = await this.fetchEvents(
        BIG_RELAY_URLS.concat(this.relayUrls),
        JSON.parse(filterStr)
      )
      return event
    }
  })
  private eventDataloader = new DataLoader<string, NEvent | undefined>(
    this.eventBatchLoadFn.bind(this),
    {
      cacheMap: new LRUCache<string, Promise<NEvent | undefined>>({ max: 10000 })
    }
  )
  private profileDataloader = new DataLoader<string, TProfile | undefined>(
    this.profileBatchLoadFn.bind(this),
    {
      cacheMap: new LRUCache<string, Promise<TProfile | undefined>>({ max: 10000 })
    }
  )
  private relayListDataLoader = new DataLoader<string, TRelayList>(
    this.relayListBatchLoadFn.bind(this),
    {
      cacheMap: new LRUCache<string, Promise<TRelayList>>({ max: 10000 })
    }
  )

  constructor() {
    if (!ClientService.instance) {
      this.initPromise = this.init()
      ClientService.instance = this
    }
    return ClientService.instance
  }

  async init() {
    const relayGroups = await storage.getRelayGroups()
    this.relayUrls = relayGroups.find((group) => group.isActive)?.relayUrls ?? []
    eventBus.on(EVENT_TYPES.RELAY_GROUPS_CHANGED, (event) => {
      this.onRelayGroupsChange(event.detail)
    })
  }

  onRelayGroupsChange(relayGroups: TRelayGroup[]) {
    const newRelayUrls = relayGroups.find((group) => group.isActive)?.relayUrls ?? []
    this.relayUrls = newRelayUrls
  }

  listConnectionStatus() {
    return this.pool.listConnectionStatus()
  }

  async publishEvent(relayUrls: string[], event: NEvent) {
    return await Promise.any(this.pool.publish(this.relayUrls.concat(relayUrls), event))
  }

  subscribeEvents(
    urls: string[],
    filter: Filter,
    opts: {
      onEose: (events: NEvent[]) => void
      onNew: (evt: NEvent) => void
    }
  ) {
    const events: NEvent[] = []
    let eose = false
    return this.pool.subscribeMany(urls, [filter], {
      onevent: (evt) => {
        if (eose) {
          opts.onNew(evt)
        } else {
          events.push(evt)
        }
      },
      oneose: () => {
        eose = true
        opts.onEose(events.sort((a, b) => b.created_at - a.created_at))
      },
      onclose: () => {
        if (!eose) {
          opts.onEose(events.sort((a, b) => b.created_at - a.created_at))
        }
      }
    })
  }

  async fetchEvents(relayUrls: string[], filter: Filter) {
    await this.initPromise
    // If relayUrls is empty, use this.relayUrls
    return await this.pool.querySync(relayUrls.length > 0 ? relayUrls : this.relayUrls, filter)
  }

  async fetchEventByFilter(filter: Filter) {
    return this.eventCache.fetch(JSON.stringify({ ...filter, limit: 1 }))
  }

  async fetchEventById(id: string): Promise<NEvent | undefined> {
    return this.eventDataloader.load(id)
  }

  async fetchProfile(pubkey: string): Promise<TProfile | undefined> {
    return this.profileDataloader.load(pubkey)
  }

  async fetchRelayList(pubkey: string): Promise<TRelayList> {
    return this.relayListDataLoader.load(pubkey)
  }

  private async eventBatchLoadFn(ids: readonly string[]) {
    const events = await this.fetchEvents(this.relayUrls, {
      ids: ids as string[],
      limit: ids.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      eventsMap.set(event.id, event)
    }

    const missingIds = ids.filter((id) => !eventsMap.has(id))
    if (missingIds.length > 0) {
      const missingEvents = await this.fetchEvents(
        BIG_RELAY_URLS.filter((url) => !this.relayUrls.includes(url)),
        {
          ids: missingIds,
          limit: missingIds.length
        }
      )
      for (const event of missingEvents) {
        eventsMap.set(event.id, event)
      }
    }

    return ids.map((id) => eventsMap.get(id))
  }

  private async profileBatchLoadFn(pubkeys: readonly string[]) {
    const events = await this.fetchEvents(this.relayUrls, {
      authors: pubkeys as string[],
      kinds: [kinds.Metadata],
      limit: pubkeys.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      const pubkey = event.pubkey
      const existing = eventsMap.get(pubkey)
      if (!existing || existing.created_at < event.created_at) {
        eventsMap.set(pubkey, event)
      }
    }

    const missingPubkeys = pubkeys.filter((pubkey) => !eventsMap.has(pubkey))
    if (missingPubkeys.length > 0) {
      const missingEvents = await this.fetchEvents(
        BIG_RELAY_URLS.filter((url) => !this.relayUrls.includes(url)),
        {
          authors: missingPubkeys,
          kinds: [kinds.Metadata],
          limit: missingPubkeys.length
        }
      )
      for (const event of missingEvents) {
        const pubkey = event.pubkey
        const existing = eventsMap.get(pubkey)
        if (!existing || existing.created_at < event.created_at) {
          eventsMap.set(pubkey, event)
        }
      }
    }

    return pubkeys.map((pubkey) => {
      const event = eventsMap.get(pubkey)
      return event ? this.parseProfileFromEvent(event) : undefined
    })
  }

  private async relayListBatchLoadFn(pubkeys: readonly string[]) {
    const events = await this.fetchEvents(BIG_RELAY_URLS.concat(this.relayUrls), {
      authors: pubkeys as string[],
      kinds: [kinds.RelayList],
      limit: pubkeys.length
    })
    const eventsMap = new Map<string, NEvent>()
    for (const event of events) {
      const pubkey = event.pubkey
      const existing = eventsMap.get(pubkey)
      if (!existing || existing.created_at < event.created_at) {
        eventsMap.set(pubkey, event)
      }
    }

    return pubkeys.map((pubkey) => {
      const event = eventsMap.get(pubkey)
      const relayList = { write: [], read: [] } as TRelayList
      if (!event) return relayList

      event.tags.filter(tagNameEquals('r')).forEach(([, url, type]) => {
        if (!url || !isWebsocketUrl(url)) return

        const normalizedUrl = normalizeUrl(url)
        switch (type) {
          case 'w':
            relayList.write.push(normalizedUrl)
            break
          case 'r':
            relayList.read.push(normalizedUrl)
            break
          default:
            relayList.write.push(normalizedUrl)
            relayList.read.push(normalizedUrl)
        }
      })
      return {
        write: relayList.write.slice(0, 3),
        read: relayList.read.slice(0, 3)
      }
    })
  }

  private parseProfileFromEvent(event: NEvent): TProfile {
    try {
      const profileObj = JSON.parse(event.content)
      return {
        pubkey: event.pubkey,
        banner: profileObj.banner,
        avatar: profileObj.picture,
        username:
          profileObj.display_name?.trim() ||
          profileObj.name?.trim() ||
          profileObj.nip05?.split('@')[0]?.trim() ||
          formatPubkey(event.pubkey),
        nip05: profileObj.nip05,
        about: profileObj.about
      }
    } catch (err) {
      console.error(err)
      return {
        pubkey: event.pubkey,
        username: formatPubkey(event.pubkey)
      }
    }
  }
}

const instance = new ClientService()

export default instance
