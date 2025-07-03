import { extractEmojiInfosFromTags, extractZapInfoFromReceipt } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { TEmoji } from '@/types'
import { Event, kinds } from 'nostr-tools'

export type TNoteStats = {
  likes: { id: string; pubkey: string; created_at: number; emoji: TEmoji | string }[]
  reposts: Set<string>
  zaps: { pr: string; pubkey: string; amount: number; comment?: string }[]
  updatedAt?: number
}

class NoteStatsService {
  static instance: NoteStatsService
  private noteStatsMap: Map<string, Partial<TNoteStats>> = new Map()
  private noteStatsSubscribers = new Map<string, Set<() => void>>()

  constructor() {
    if (!NoteStatsService.instance) {
      NoteStatsService.instance = this
    }
    return NoteStatsService.instance
  }

  subscribeNoteStats(noteId: string, callback: () => void) {
    let set = this.noteStatsSubscribers.get(noteId)
    if (!set) {
      set = new Set()
      this.noteStatsSubscribers.set(noteId, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.noteStatsSubscribers.delete(noteId)
    }
  }

  private notifyNoteStats(noteId: string) {
    const set = this.noteStatsSubscribers.get(noteId)
    if (set) {
      set.forEach((cb) => cb())
    }
  }

  getNoteStats(id: string): Partial<TNoteStats> | undefined {
    return this.noteStatsMap.get(id)
  }

  addZap(pubkey: string, eventId: string, pr: string, amount: number, comment?: string) {
    const old = this.noteStatsMap.get(eventId)
    const zaps = old?.zaps || []
    this.noteStatsMap.set(eventId, {
      ...old,
      zaps: [...zaps, { pr, pubkey, amount, comment }].sort((a, b) => b.amount - a.amount)
    })
    return this.noteStatsMap
  }

  updateNoteStatsByEvents(events: Event[]) {
    const updatedEventIdSet = new Set<string>()
    events.forEach((evt) => {
      let updatedEventId: string | undefined
      if (evt.kind === kinds.Reaction) {
        updatedEventId = this.addLikeByEvent(evt)
      } else if (evt.kind === kinds.Repost) {
        updatedEventId = this.addRepostByEvent(evt)
      } else if (evt.kind === kinds.Zap) {
        updatedEventId = this.addZapByEvent(evt)
      }
      if (updatedEventId) {
        updatedEventIdSet.add(updatedEventId)
      }
    })
    updatedEventIdSet.forEach((eventId) => {
      this.notifyNoteStats(eventId)
    })
  }

  private addLikeByEvent(evt: Event) {
    const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
    if (!targetEventId) return

    const old = this.noteStatsMap.get(targetEventId) || {}
    const likes = old.likes || []
    const exists = likes.find((l) => l.id === evt.id)
    if (exists) return

    let emoji: TEmoji | string = evt.content.trim()
    if (!emoji) return

    if (/^:[a-zA-Z0-9_-]+:$/.test(evt.content)) {
      const emojiInfos = extractEmojiInfosFromTags(evt.tags)
      const shortcode = evt.content.split(':')[1]
      const emojiInfo = emojiInfos.find((info) => info.shortcode === shortcode)
      if (emojiInfo) {
        emoji = emojiInfo
      } else {
        console.log(`Emoji not found for shortcode: ${shortcode}`, emojiInfos)
      }
    }

    likes.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at, emoji })
    this.noteStatsMap.set(targetEventId, { ...old, likes })
    return targetEventId
  }

  private addRepostByEvent(evt: Event) {
    const eventId = evt.tags.find(tagNameEquals('e'))?.[1]
    if (!eventId) return

    const old = this.noteStatsMap.get(eventId) || {}
    const reposts = old.reposts || new Set()
    reposts.add(evt.id)
    this.noteStatsMap.set(eventId, { ...old, reposts })
    return eventId
  }

  private addZapByEvent(evt: Event) {
    const info = extractZapInfoFromReceipt(evt)
    if (!info) return
    const { originalEventId, senderPubkey, invoice, amount, comment } = info
    if (!originalEventId || !senderPubkey) return

    const old = this.noteStatsMap.get(originalEventId) || {}
    const zaps = old.zaps || []
    const exists = zaps.find((zap) => zap.pr === invoice)
    if (exists) return

    zaps.push({ pr: invoice, pubkey: senderPubkey, amount, comment })
    this.noteStatsMap.set(originalEventId, { ...old, zaps })
    return originalEventId
  }
}

const instance = new NoteStatsService()

export default instance
