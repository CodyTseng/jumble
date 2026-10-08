import {
  applyRelayObservation,
  mergeRelayObservationRecord,
  RelayObservation,
  RelayObservationRecord
} from '@/lib/relay-observation'
import { normalizeUrl } from '@/lib/url'
import indexedDb from './indexed-db.service'

export class RelayObservationService {
  private records = new Map<string, RelayObservationRecord>()
  private pending = new Map<string, RelayObservationRecord>()
  private listeners = new Set<() => void>()
  private protectedUrls: string[] = []
  private timer?: ReturnType<typeof setTimeout>
  private notifying?: ReturnType<typeof setTimeout>
  private flushing = false
  private ready: Promise<void>
  version = 0

  constructor() {
    this.ready = this.load()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush()
    })
    window.addEventListener('pagehide', () => {
      void this.flush()
    })
  }

  private async load() {
    try {
      this.records = new Map(
        (await indexedDb.getRelayObservations()).map((record) => [record.url, record])
      )
    } catch (error) {
      this.records.clear()
      console.warn('Unable to load relay observations', error)
    }
    for (const delta of this.pending.values()) {
      const record = this.records.get(delta.url) ?? { url: delta.url, updatedAt: 0, days: [] }
      mergeRelayObservationRecord(record, delta)
      this.records.set(record.url, record)
    }
    this.prune()
    this.notify()
  }

  setProtectedUrls(urls: string[]) {
    this.protectedUrls = Array.from(new Set(urls.map(normalizeUrl)))
    this.prune()
  }

  record = (observation: RelayObservation) => {
    const normalized = { ...observation, url: normalizeUrl(observation.url) }
    const newUrl = !this.records.has(normalized.url) || !this.pending.has(normalized.url)
    const delta = this.pending.get(normalized.url) ?? {
      url: normalized.url,
      updatedAt: 0,
      days: []
    }
    applyRelayObservation(delta, normalized)
    this.pending.set(delta.url, delta)
    this.apply(normalized)
    if (newUrl && (this.records.size > 500 || this.pending.size > 500)) this.prune()
    this.notify()
    if (!this.timer)
      this.timer = setTimeout(() => {
        void this.flush()
      }, 1_000)
  }

  private apply(observation: RelayObservation) {
    const record = this.records.get(observation.url) ?? {
      url: observation.url,
      updatedAt: 0,
      days: []
    }
    applyRelayObservation(record, observation)
    this.records.set(record.url, record)
  }

  private prune() {
    this.pruneMap(this.records)
    this.pruneMap(this.pending)
  }

  private pruneMap(map: Map<string, RelayObservationRecord>) {
    const protectedSet = new Set(this.protectedUrls)
    const records = Array.from(map.values())
      .filter((record) => !protectedSet.has(record.url))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    records.forEach((record, index) => {
      if (index >= 500 || record.updatedAt < cutoff) map.delete(record.url)
    })
  }

  private notify() {
    if (this.notifying) return
    this.notifying = setTimeout(() => {
      this.notifying = undefined
      this.version++
      this.listeners.forEach((listener) => listener())
    }, 250)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.version
  get(url: string) {
    return this.records.get(normalizeUrl(url))
  }
  list() {
    return Array.from(this.records.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    await this.ready
    if (this.flushing || !this.pending.size) return
    this.flushing = true
    const batch = this.pending
    this.pending = new Map()
    try {
      await indexedDb.saveRelayObservations(Array.from(batch.values()), this.protectedUrls)
    } catch (error) {
      for (const delta of batch.values()) {
        const record = this.pending.get(delta.url) ?? { url: delta.url, updatedAt: 0, days: [] }
        mergeRelayObservationRecord(record, delta)
        this.pending.set(delta.url, record)
      }
      this.prune()
      console.warn('Unable to save relay observations', error)
    } finally {
      this.flushing = false
      if (this.pending.size && !this.timer)
        this.timer = setTimeout(() => {
          void this.flush()
        }, 1_000)
    }
  }
}

export default new RelayObservationService()
