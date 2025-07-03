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
    const newRepostsMap = new Map<string, Set<string>>()
    const newLikesMap = new Map<
      string,
      { id: string; pubkey: string; created_at: number; emoji: TEmoji | string }[]
    >()
    const newZapsMap = new Map<
      string,
      { pr: string; pubkey: string; amount: number; comment?: string }[]
    >()
    events.forEach((evt) => {
      if (evt.kind === kinds.Repost) {
        const eventId = evt.tags.find(tagNameEquals('e'))?.[1]
        if (!eventId) return
        const newReposts = newRepostsMap.get(eventId) || new Set()
        newReposts.add(evt.pubkey)
        newRepostsMap.set(eventId, newReposts)
        return
      }

      if (evt.kind === kinds.Reaction) {
        const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
        if (targetEventId) {
          const newLikes = newLikesMap.get(targetEventId) || []
          if (newLikes.some((like) => like.id === evt.id)) return

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
          newLikes.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at, emoji })
          newLikesMap.set(targetEventId, newLikes)
        }
        return
      }

      if (evt.kind === kinds.Zap) {
        const info = extractZapInfoFromReceipt(evt)
        if (!info) return
        const { originalEventId, senderPubkey, invoice, amount, comment } = info
        if (!originalEventId || !senderPubkey) return
        const newZaps = newZapsMap.get(originalEventId) || []
        newZaps.push({ pr: invoice, pubkey: senderPubkey, amount, comment })
        newZapsMap.set(originalEventId, newZaps)
        return
      }
    })

    const updatedEventIds = new Set<string>()
    newRepostsMap.forEach((newReposts, eventId) => {
      const old = this.noteStatsMap.get(eventId) || {}
      const reposts = old.reposts || new Set()
      newReposts.forEach((repost) => reposts.add(repost))
      this.noteStatsMap.set(eventId, { ...old, reposts })
      updatedEventIds.add(eventId)
    })
    newLikesMap.forEach((newLikes, eventId) => {
      const old = this.noteStatsMap.get(eventId) || {}
      const likes = old.likes || []
      newLikes.forEach((like) => {
        const exists = likes.find((l) => l.id === like.id)
        if (!exists) {
          likes.push(like)
        }
      })
      likes.sort((a, b) => b.created_at - a.created_at)
      this.noteStatsMap.set(eventId, { ...old, likes })
      updatedEventIds.add(eventId)
    })
    newZapsMap.forEach((newZaps, eventId) => {
      const old = this.noteStatsMap.get(eventId) || {}
      const zaps = old.zaps || []
      const exists = new Set(zaps.map((zap) => zap.pr))
      newZaps.forEach((zap) => {
        if (!exists.has(zap.pr)) {
          exists.add(zap.pr)
          zaps.push(zap)
        }
      })
      zaps.sort((a, b) => b.amount - a.amount)
      this.noteStatsMap.set(eventId, { ...old, zaps })
      updatedEventIds.add(eventId)
    })
    updatedEventIds.forEach((eventId) => {
      this.notifyNoteStats(eventId)
    })
  }
}

const instance = new NoteStatsService()

export default instance
