import { ExtendedKind } from '@/constants'
import { compareEvents } from '@/lib/event'
import { getDefaultRelayUrls } from '@/lib/relay'
import { mergeTimelines } from '@/lib/timeline'
import { kinds, NostrEvent } from 'nostr-tools'
import client from './client.service'
import stuffStatsService from './stuff-stats.service'
import threadService from './thread.service'

export const NOTIFICATION_KINDS = [
  kinds.ShortTextNote,
  kinds.Repost,
  kinds.GenericRepost,
  kinds.Reaction,
  kinds.Zap,
  kinds.Highlights,
  ExtendedKind.COMMENT,
  ExtendedKind.POLL_RESPONSE,
  ExtendedKind.VOICE_COMMENT,
  ExtendedKind.POLL
]

const SUBSCRIPTION_LIMIT = 100

class NotificationService {
  static instance: NotificationService

  private currentPubkey: string | null = null
  private events: NostrEvent[] = []
  private timelineKey: string | undefined
  private until: number | undefined
  private subscriptionCloser: (() => void) | null = null
  private startPromise: Promise<void> | null = null
  private initialLoading = false

  private dataChangedListeners = new Set<() => void>()
  private newEventListeners = new Set<(event: NostrEvent) => void>()
  private loadingListeners = new Set<(loading: boolean) => void>()

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  getEvents(): NostrEvent[] {
    return this.events
  }

  getInitialLoading(): boolean {
    return this.initialLoading
  }

  getUntil(): number | undefined {
    return this.until
  }

  hasMore(): boolean {
    return this.until !== undefined
  }

  onDataChanged(listener: () => void): () => void {
    this.dataChangedListeners.add(listener)
    return () => {
      this.dataChangedListeners.delete(listener)
    }
  }

  onNewEvent(listener: (event: NostrEvent) => void): () => void {
    this.newEventListeners.add(listener)
    return () => {
      this.newEventListeners.delete(listener)
    }
  }

  onLoadingChanged(listener: (loading: boolean) => void): () => void {
    this.loadingListeners.add(listener)
    return () => {
      this.loadingListeners.delete(listener)
    }
  }

  async start(pubkey: string): Promise<void> {
    if (this.currentPubkey === pubkey && (this.startPromise || this.subscriptionCloser)) {
      return this.startPromise ?? Promise.resolve()
    }
    this.stop()
    this.currentPubkey = pubkey

    this.startPromise = this._start(pubkey)
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  stop(): void {
    if (this.subscriptionCloser) {
      this.subscriptionCloser()
      this.subscriptionCloser = null
    }
    this.currentPubkey = null
    this.events = []
    this.timelineKey = undefined
    this.until = undefined
    this.initialLoading = false
    this.emitDataChanged()
  }

  async restart(): Promise<void> {
    const pubkey = this.currentPubkey
    if (!pubkey) return
    if (this.subscriptionCloser) {
      this.subscriptionCloser()
      this.subscriptionCloser = null
    }
    this.events = []
    this.timelineKey = undefined
    this.until = undefined
    await this._start(pubkey)
  }

  async loadMore(limit = SUBSCRIPTION_LIMIT): Promise<boolean> {
    if (!this.timelineKey || this.until === undefined) return false
    const newEvents = await client.loadMoreTimeline(this.timelineKey, this.until, limit)
    if (newEvents.length === 0) {
      this.until = undefined
      this.emitDataChanged()
      return false
    }

    const filtered = newEvents.filter((evt) => evt.pubkey !== this.currentPubkey)
    if (filtered.length > 0) {
      const idSet = new Set(this.events.map((e) => e.id))
      for (const evt of filtered) {
        if (!idSet.has(evt.id)) {
          this.events.push(evt)
          idSet.add(evt.id)
        }
      }
    }
    this.until = newEvents[newEvents.length - 1].created_at - 1
    this.emitDataChanged()
    return true
  }

  private async _start(pubkey: string): Promise<void> {
    this.initialLoading = true
    this.emitLoadingChanged()

    const filter = {
      '#p': [pubkey],
      kinds: NOTIFICATION_KINDS,
      limit: SUBSCRIPTION_LIMIT
    }

    try {
      const stored = (await client.getEventsFromIndexed(filter)).filter(
        (evt) => evt.pubkey !== pubkey
      )
      if (this.currentPubkey === pubkey && stored.length > 0) {
        this.events = stored
        this.emitDataChanged()
      }
    } catch {
      // ignore
    }

    let relays: string[]
    try {
      const relayList = await client.fetchRelayList(pubkey)
      relays = relayList.read.length > 0 ? relayList.read.slice(0, 5) : getDefaultRelayUrls()
    } catch {
      relays = getDefaultRelayUrls()
    }

    if (this.currentPubkey !== pubkey) return

    const { closer, timelineKey } = await client.subscribeTimeline(
      [{ urls: relays, filter }],
      {
        onEvents: (events, eosed) => {
          if (this.currentPubkey !== pubkey) return
          const filteredEvents = events.filter((evt) => evt.pubkey !== pubkey)
          if (eosed) {
            this.events = this.mergeWithStored(filteredEvents)
            this.until =
              filteredEvents.length > 0
                ? filteredEvents[filteredEvents.length - 1].created_at - 1
                : undefined
            this.initialLoading = false
            threadService.addRepliesToThread(filteredEvents)
            stuffStatsService.updateStuffStatsByEvents(filteredEvents)
            this.emitLoadingChanged()
            this.emitDataChanged()
          }
        },
        onNew: (event) => {
          if (this.currentPubkey !== pubkey) return
          if (event.pubkey === pubkey) return
          this.handleNewEvent(event)
          threadService.addRepliesToThread([event])
          stuffStatsService.updateStuffStatsByEvents([event])
        }
      },
      { needSaveToDb: true }
    )

    if (this.currentPubkey !== pubkey) {
      closer()
      return
    }
    this.timelineKey = timelineKey
    this.subscriptionCloser = closer
  }

  private handleNewEvent(event: NostrEvent): void {
    const idx = this.events.findIndex((e) => compareEvents(e, event) <= 0)
    if (idx !== -1 && this.events[idx].id === event.id) {
      return
    }
    if (idx === -1) {
      this.events = [...this.events, event]
    } else {
      this.events = [...this.events.slice(0, idx), event, ...this.events.slice(idx)]
    }
    this.emitNewEvent(event)
  }

  private mergeWithStored(liveEvents: NostrEvent[]): NostrEvent[] {
    const cachedFromInitialRead = this.events
    if (cachedFromInitialRead.length === 0) return liveEvents
    if (liveEvents.length === 0) return cachedFromInitialRead

    const idSet = new Set(liveEvents.map((e) => e.id))
    const oldestLive = liveEvents[liveEvents.length - 1].created_at
    const supplemental = cachedFromInitialRead.filter((evt) => {
      if (idSet.has(evt.id)) return false
      idSet.add(evt.id)
      return true
    })
    if (supplemental.length === 0) return liveEvents
    if (supplemental[0].created_at < oldestLive - 1) return liveEvents
    return mergeTimelines([liveEvents, supplemental])
  }

  private emitDataChanged(): void {
    for (const listener of this.dataChangedListeners) {
      listener()
    }
  }

  private emitNewEvent(event: NostrEvent): void {
    for (const listener of this.newEventListeners) {
      listener(event)
    }
    this.emitDataChanged()
  }

  private emitLoadingChanged(): void {
    for (const listener of this.loadingListeners) {
      listener(this.initialLoading)
    }
  }
}

const notificationService = NotificationService.getInstance()
export default notificationService
