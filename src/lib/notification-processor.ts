import type { NostrEvent } from 'nostr-tools'
import type { TNotificationFilter } from '@/types'
import { getEventAuthorPubkey } from './event-core'
import { getNotificationFilterType } from './notification'
import { verifyEvent } from './nostr-verifier'

export type NotificationCursor = { pubkey: string; ids: string[] }
export type NotificationProcessorOptions = {
  pubkey: string
  filters: ReadonlySet<TNotificationFilter>
  filter: (event: NostrEvent) => Promise<boolean>
  canNotify: () => boolean
  notify: (event: NostrEvent, type: TNotificationFilter) => Promise<unknown>
  cursor?: NotificationCursor | null
  saveCursor?: (cursor: NotificationCursor) => Promise<void>
  since?: number
  maxAgeSeconds?: number
  now?: () => number
}

/** One verified/filter/dedupe pipeline for foreground and service-owned JS runtimes. */
export class NotificationProcessor {
  private seen: Set<string>
  private pending = new Set<string>()
  private stopped = false
  private writes: Promise<void> = Promise.resolve()
  constructor(private options: NotificationProcessorOptions) {
    this.seen = new Set(
      options.cursor?.pubkey === options.pubkey ? options.cursor.ids.slice(-4096) : []
    )
  }
  stop() {
    this.stopped = true
  }
  async process(event: NostrEvent): Promise<boolean> {
    if (this.stopped || this.seen.has(event.id) || this.pending.has(event.id)) return false
    if (
      !verifyEvent(event) ||
      getEventAuthorPubkey(event) === this.options.pubkey ||
      !event.tags.some((tag) => tag[0] === 'p' && tag[1] === this.options.pubkey)
    )
      return false
    const now = this.options.now?.() ?? Math.floor(Date.now() / 1000)
    if (
      this.options.maxAgeSeconds !== undefined &&
      (event.created_at < now - this.options.maxAgeSeconds || event.created_at > now + 60)
    )
      return false
    if (this.options.since !== undefined && event.created_at < this.options.since) return false
    const type = getNotificationFilterType(event, this.options.pubkey)
    if (!type || !this.options.filters.has(type)) return false
    this.pending.add(event.id)
    try {
      if (!(await this.options.filter(event)) || this.stopped) return false
      this.seen.add(event.id)
      if (this.seen.size > 4096) this.seen.delete(this.seen.values().next().value!)
      if (this.options.saveCursor) {
        const cursor = { pubkey: this.options.pubkey, ids: Array.from(this.seen) }
        this.writes = this.writes.catch(() => {}).then(() => this.options.saveCursor!(cursor))
        await this.writes
      }
      if (this.stopped || !this.options.canNotify()) return false
      await this.options.notify(event, type)
      return true
    } finally {
      this.pending.delete(event.id)
    }
  }
}
