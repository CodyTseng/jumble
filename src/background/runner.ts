import type { NostrEvent } from 'nostr-tools'
import type { TNotificationFilter } from '@/types'
import { normalizeUrl } from '@/lib/url'
import { SmartPool } from '@/lib/smart-pool'
import { NOTIFICATION_KINDS, notificationFilter } from '@/lib/notification'
import { NotificationProcessor, type NotificationCursor } from '@/lib/notification-processor'
import { fetchTrustPercentiles, meetsTrustScore, type JsonRequest } from '@/lib/trust-score'
import { validateZapReceipt } from '@/lib/zap-validation'
import { BoundedMap } from '@/lib/bounded-map'

export type BackgroundNotificationConfig = {
  pubkey: string
  relays: string[]
  enabledAt: number
  filters: TNotificationFilter[]
  descriptions: Partial<Record<TNotificationFilter, string>>
  muted: string[]
  trusted: string[]
  minTrustScore: number
  hideMutedMentions: boolean
  zapIssuer: string
}
export type BackgroundPorts = {
  fetchJson: JsonRequest
  saveCursor: (cursor: NotificationCursor) => Promise<void>
  notify: (id: string, body: string) => Promise<void>
  isForeground: () => boolean
  isOnline: () => boolean
  status: (connections: number, subscriptions: number) => void
  error: (error: unknown) => void
  websocket: typeof WebSocket
}

/** Shares SmartPool, verification, event classification, zap and trust rules with the app. */
export class BackgroundNotificationRunner {
  private pool: SmartPool
  private processor: NotificationProcessor
  private closers = new Set<{ close: (reason?: string) => void }>()
  private open = new Set<string>()
  private subscribed = new Set<string>()
  private stopped = false
  private retry = new Map<string, ReturnType<typeof setTimeout>>()
  private scores = new BoundedMap<string, Promise<number | null>>({ maxSize: 1000 })
  constructor(
    private config: BackgroundNotificationConfig,
    private ports: BackgroundPorts,
    cursor?: NotificationCursor | null
  ) {
    this.pool = new SmartPool({ websocketImplementation: ports.websocket })
    const muted = new Set(config.muted),
      trusted = new Set(config.trusted)
    this.processor = new NotificationProcessor({
      pubkey: config.pubkey,
      filters: new Set(config.filters),
      cursor,
      since: config.enabledAt,
      maxAgeSeconds: 300,
      canNotify: () => !ports.isForeground(),
      saveCursor: ports.saveCursor,
      filter: (event) =>
        notificationFilter(event, {
          pubkey: config.pubkey,
          mutePubkeySet: muted,
          hideContentMentioningMutedUsers: config.hideMutedMentions,
          meetsMinTrustScore: (key) =>
            meetsTrustScore(key, config.pubkey, config.minTrustScore, trusted, async (key) => {
              let pending = this.scores.get(key)
              if (!pending) {
                pending = fetchTrustPercentiles([key], ports.fetchJson).then((values) => values[0])
                this.scores.set(key, pending)
              }
              return pending
            }),
          validateZapReceipt: (event) =>
            validateZapReceipt(event, async (recipient) =>
              recipient === config.pubkey ? config.zapIssuer || null : null
            )
        }),
      notify: (event, type) => ports.notify(event.id, config.descriptions[type] ?? 'Jumble')
    })
  }
  async start() {
    this.pool.setNetworkOnline(this.ports.isOnline())
    await Promise.all(this.config.relays.map((url) => this.subscribe(url)))
  }
  private async subscribe(url: string) {
    url = normalizeUrl(url)
    if (this.stopped) return
    try {
      const relay = await this.pool.ensureRelay(url)
      if (this.stopped) return
      const closer = relay.subscribe(
        [
          {
            '#p': [this.config.pubkey],
            kinds: NOTIFICATION_KINDS,
            since: Math.max(Math.floor(Date.now() / 1000) - 300, this.config.enabledAt),
            limit: 100
          }
        ],
        {
          onevent: (event: NostrEvent) => {
            this.subscribed.add(url)
            this.publishStatus()
            void this.processor.process(event).catch(this.ports.error)
          },
          oneose: () => {
            this.subscribed.add(url)
            this.publishStatus()
          },
          onclose: () => {
            if (closer) this.closers.delete(closer)
            this.subscribed.delete(url)
            this.publishStatus()
            if (!this.stopped && !this.retry.has(url))
              this.retry.set(
                url,
                setTimeout(() => {
                  this.retry.delete(url)
                  void this.subscribe(url)
                }, 30_000)
              )
          }
        }
      )
      this.closers.add(closer)
    } catch (error) {
      if (!this.stopped) this.ports.error(error)
    }
  }
  transportChanged(url: string, open: boolean) {
    url = normalizeUrl(url)
    if (open) this.open.add(url)
    else this.open.delete(url)
    this.publishStatus()
  }
  setNetworkOnline(online: boolean) {
    this.pool.setNetworkOnline(online)
    if (online) this.tick()
  }
  tick() {
    if (!this.stopped) {
      this.pool.setNetworkOnline(this.ports.isOnline())
      void this.pool.checkRelays().catch(this.ports.error)
    }
  }
  private publishStatus() {
    if (!this.stopped)
      this.ports.status(
        this.open.size,
        Array.from(this.subscribed).filter((url) => this.open.has(url)).length
      )
  }
  stop() {
    this.stopped = true
    this.processor.stop()
    this.retry.forEach(clearTimeout)
    this.retry.clear()
    this.closers.forEach((closer) => closer.close())
    this.closers.clear()
    this.pool.close(this.config.relays)
  }
}
