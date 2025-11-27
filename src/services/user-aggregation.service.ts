import { getEventKey } from '@/lib/event'
import storage from '@/services/local-storage.service'
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
  private feedUserEventsMap: Map<string, Map<string, Event[]>> = new Map()
  private listeners: Set<() => void> = new Set()

  constructor() {
    if (UserAggregationService.instance) {
      return UserAggregationService.instance
    }
    UserAggregationService.instance = this
    this.pinnedPubkeys = storage.getPinnedPubkeys()
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
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
    this.notify()
  }

  unpinUser(pubkey: string) {
    this.pinnedPubkeys.delete(pubkey)
    storage.setPinnedPubkeys(this.pinnedPubkeys)
    this.notify()
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

  // Cache management for quick access
  setCachedEvents(feedId: string, aggregations: TUserAggregation[]) {
    const map = new Map<string, Event[]>()
    aggregations.forEach((agg) => map.set(agg.pubkey, agg.events))
    this.feedUserEventsMap.set(feedId, map)
  }

  getUserEvents(feedId: string, pubkey: string): Event[] {
    return this.feedUserEventsMap.get(feedId)?.get(pubkey) || []
  }
}

const userAggregationService = new UserAggregationService()
export default userAggregationService
