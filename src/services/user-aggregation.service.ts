import { StorageKey } from '@/constants'
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
  private cachedEventsMap: Map<string, Event[]> = new Map()
  private listeners: Set<() => void> = new Set()

  constructor() {
    if (UserAggregationService.instance) {
      return UserAggregationService.instance
    }
    UserAggregationService.instance = this
    this.loadFromStorage()
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

  private loadFromStorage() {
    try {
      const pinnedData = localStorage.getItem(StorageKey.PINNED_USERS)
      if (pinnedData) {
        this.pinnedPubkeys = new Set(JSON.parse(pinnedData))
      }
    } catch (error) {
      console.error('Failed to load user aggregation data from storage', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(StorageKey.PINNED_USERS, JSON.stringify([...this.pinnedPubkeys]))
    } catch (error) {
      console.error('Failed to save user aggregation data to storage', error)
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
    this.saveToStorage()
    this.notify()
  }

  unpinUser(pubkey: string) {
    this.pinnedPubkeys.delete(pubkey)
    this.saveToStorage()
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

    events.forEach((event) => {
      const existing = userEventsMap.get(event.pubkey) || []
      existing.push(event)
      userEventsMap.set(event.pubkey, existing)
    })

    const since = dayjs().subtract(1, 'day').unix()
    const aggregations: TUserAggregation[] = []
    userEventsMap.forEach((events, pubkey) => {
      const sortedEvents = events
        .sort((a, b) => b.created_at - a.created_at)
        .filter((evt) => evt.created_at > since)
      if (sortedEvents.length === 0) {
        return
      }

      aggregations.push({
        pubkey,
        events: sortedEvents,
        count: events.length,
        lastEventTime: sortedEvents[0].created_at
      })
    })

    return aggregations.sort((a, b) => b.lastEventTime - a.lastEventTime)
  }

  // Sort aggregations with pinned users first
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
  setCachedEvents(feedId: string, events: Event[]) {
    this.cachedEventsMap.set(feedId, events)
  }

  getCachedEvents(feedId: string): Event[] | undefined {
    return this.cachedEventsMap.get(feedId)
  }

  getUserEvents(feedId: string, pubkey: string): Event[] {
    const allEvents = this.getCachedEvents(feedId) || []
    return allEvents.filter((event) => event.pubkey === pubkey)
  }
}

const userAggregationService = new UserAggregationService()
export default userAggregationService
