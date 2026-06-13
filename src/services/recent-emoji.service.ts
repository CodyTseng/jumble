import { TEmoji, TSkinTone } from '@/types'

const STORAGE_KEY = 'recent-emojis'
const SKIN_TONE_KEY = 'emoji-skin-tone'
const MAX_ENTRIES = 30

type StoredEntry = {
  key: string
  count: number
  lastUsedAt: number
  entry: string | TEmoji
}

function entryKey(entry: string | TEmoji): string {
  if (typeof entry === 'string') return `n:${entry}`
  return `c:${entry.shortcode}|${entry.url}`
}

class RecentEmojiService {
  static instance: RecentEmojiService
  private entries: StoredEntry[] = []
  private skinTone: TSkinTone = 0
  private hydrated = false
  private listeners = new Set<() => void>()

  constructor() {
    if (!RecentEmojiService.instance) {
      RecentEmojiService.instance = this
    }
    return RecentEmojiService.instance
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }

  markBroken(url: string): void {
    if (!url) return
    this.hydrate()
    const before = this.entries.length
    this.entries = this.entries.filter(
      (e) => typeof e.entry === 'string' || e.entry.url !== url
    )
    if (this.entries.length === before) return
    this.persist()
    this.notify()
  }

  private hydrate() {
    if (this.hydrated) return
    this.hydrated = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          this.entries = parsed
            .filter(
              (e) =>
                e &&
                typeof e.key === 'string' &&
                typeof e.count === 'number' &&
                typeof e.lastUsedAt === 'number' &&
                e.entry !== undefined
            )
            .slice(0, MAX_ENTRIES)
        }
      }
      const tone = localStorage.getItem(SKIN_TONE_KEY)
      if (tone) {
        const n = parseInt(tone, 10)
        if (n >= 0 && n <= 5) this.skinTone = n as TSkinTone
      }
    } catch {
      // ignore
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries))
    } catch {
      // ignore (quota / private mode)
    }
  }

  getRecent(limit = MAX_ENTRIES): (string | TEmoji)[] {
    this.hydrate()
    return this.entries
      .slice()
      .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
      .slice(0, limit)
      .map((e) => e.entry)
  }

  add(entry: string | TEmoji): void {
    this.hydrate()
    const key = entryKey(entry)
    const now = Date.now()
    const existing = this.entries.find((e) => e.key === key)
    if (existing) {
      existing.count += 1
      existing.lastUsedAt = now
      existing.entry = entry
    } else {
      this.entries.push({ key, count: 1, lastUsedAt: now, entry })
    }
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
      this.entries = this.entries.slice(0, MAX_ENTRIES)
    }
    this.persist()
  }

  getSkinTone(): TSkinTone {
    this.hydrate()
    return this.skinTone
  }

  setSkinTone(tone: TSkinTone): void {
    this.skinTone = tone
    try {
      localStorage.setItem(SKIN_TONE_KEY, String(tone))
    } catch {
      // ignore
    }
  }
}

const instance = new RecentEmojiService()
export default instance
