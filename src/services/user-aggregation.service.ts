import { getEventKey } from '@/lib/event'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'

export type TUserAggregation = {
  pubkey: string
  events: Event[]
  count: number
  lastEventTime: number
}

class UserAggregationService {
  static instance: UserAggregationService

  private pinnedPubkeys: Set<string> = new Set()
  private aggregationStore: Map<string, Map<string, Event[]>> = new Map()
  private listenersMap: Map<string, Set<() => void>> = new Map()

  constructor() {
    if (UserAggregationService.instance) {
      return UserAggregationService.instance
    }
    UserAggregationService.instance = this
    this.pinnedPubkeys = storage.getPinnedPubkeys()
  }

  subscribeAggregation(feedId: string, pubkey: string, listener: () => void) {
    return this.subscribe(`${feedId}:${pubkey}`, listener)
  }

  private notifyAggregation(feedId: string, pubkey: string) {
    this.notify(`${feedId}:${pubkey}`)
  }

  subscribePinnedUsers(listener: () => void) {
    return this.subscribe('pin', listener)
  }

  private notifyPinnedUsers() {
    this.notify('pin')
  }

  private subscribe(type: string, listener: () => void) {
    if (!this.listenersMap.has(type)) {
      this.listenersMap.set(type, new Set())
    }
    this.listenersMap.get(type)!.add(listener)

    return () => {
      this.listenersMap.get(type)?.delete(listener)
      if (this.listenersMap.get(type)?.size === 0) {
        this.listenersMap.delete(type)
      }
    }
  }

  private notify(type: string) {
    const listeners = this.listenersMap.get(type)
    if (listeners) {
      listeners.forEach((listener) => listener())
    }
  }

  // Pinned users management
  getPinnedPubkeys(): string[] {
    return [...this.pinnedPubkeys]
  }

  isPinned(pubkey: string): boolean {
    return this.pinnedPubkeys.has(pubkey)
  }

  pinUser(pubkey: string) {
    this.pinnedPubkeys.add(pubkey)
    storage.setPinnedPubkeys(this.pinnedPubkeys)
    this.notifyPinnedUsers()
  }

  unpinUser(pubkey: string) {
    this.pinnedPubkeys.delete(pubkey)
    storage.setPinnedPubkeys(this.pinnedPubkeys)
    this.notifyPinnedUsers()
  }

  togglePin(pubkey: string) {
    if (this.isPinned(pubkey)) {
      this.unpinUser(pubkey)
    } else {
      this.pinUser(pubkey)
    }
  }

  // Aggregate events by user
  aggregateByUser(events: Event[]): TUserAggregation[] {
    const userEventsMap = new Map<string, Event[]>()
    const processedKeys = new Set<string>()
    const since = dayjs().subtract(1, 'day').unix()

    events.forEach((event) => {
      if (event.created_at < since) return
      const key = getEventKey(event)
      if (processedKeys.has(key)) return
      processedKeys.add(key)

      const existing = userEventsMap.get(event.pubkey) || []
      existing.push(event)
      userEventsMap.set(event.pubkey, existing)
    })

    const aggregations: TUserAggregation[] = []
    userEventsMap.forEach((events, pubkey) => {
      if (events.length === 0) {
        return
      }

      aggregations.push({
        pubkey,
        events: events,
        count: events.length,
        lastEventTime: events[0].created_at
      })
    })

    return aggregations.sort((a, b) => {
      return b.lastEventTime - a.lastEventTime
    })
  }

  sortWithPinned(aggregations: TUserAggregation[]): TUserAggregation[] {
    const pinned: TUserAggregation[] = []
    const unpinned: TUserAggregation[] = []

    aggregations.forEach((agg) => {
      if (this.isPinned(agg.pubkey)) {
        pinned.push(agg)
      } else {
        unpinned.push(agg)
      }
    })

    return [...pinned, ...unpinned]
  }

  saveAggregations(feedId: string, aggregations: TUserAggregation[]) {
    const map = new Map<string, Event[]>()
    aggregations.forEach((agg) => map.set(agg.pubkey, agg.events))
    this.aggregationStore.set(feedId, map)
    aggregations.forEach((agg) => {
      this.notifyAggregation(feedId, agg.pubkey)
    })
  }

  getAggregation(feedId: string, pubkey: string): Event[] {
    return this.aggregationStore.get(feedId)?.get(pubkey) || []
  }

  clearAggregations(feedId: string) {
    this.aggregationStore.delete(feedId)
  }

  getFeedId(subRequests: TFeedSubRequest[], showKinds: number[] = []): string {
    const requestStr = subRequests
      .map((req) => {
        const urls = req.urls.sort().join(',')
        const filter = Object.entries(req.filter)
          .filter(([key]) => !['since', 'until', 'limit'].includes(key))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
          .join('|')
        return `${urls}#${filter}`
      })
      .join(';;')

    const kindsStr = showKinds.sort((a, b) => a - b).join(',')
    const input = `${requestStr}::${kindsStr}`

    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    return Math.abs(hash).toString(36)
  }
}

const userAggregationService = new UserAggregationService()
export default userAggregationService
