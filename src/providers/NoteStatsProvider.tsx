import { extractEmojiInfosFromTags, extractZapInfoFromReceipt } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

export type TNoteStats = {
  likes: { id: string; pubkey: string; created_at: number; emoji: TEmoji | string }[]
  reposts: Set<string>
  zaps: { pr: string; pubkey: string; amount: number; comment?: string }[]
  replyCount: number
  updatedAt?: number
}

type TNoteStatsContext = {
  noteStatsMap: Map<string, Partial<TNoteStats>>
  updateNoteReplyCount: (noteId: string, replyCount: number) => void
  addZap: (eventId: string, pr: string, amount: number, comment?: string) => void
  updateNoteStatsByEvents: (events: Event[]) => void
  fetchNoteStats: (event: Event) => Promise<Partial<TNoteStats> | undefined>
}

const NoteStatsContext = createContext<TNoteStatsContext | undefined>(undefined)

export const useNoteStats = () => {
  const context = useContext(NoteStatsContext)
  if (!context) {
    throw new Error('useNoteStats must be used within a NoteStatsProvider')
  }
  return context
}

export function NoteStatsProvider({ children }: { children: React.ReactNode }) {
  const [noteStatsMap, setNoteStatsMap] = useState<Map<string, Partial<TNoteStats>>>(new Map())
  const { pubkey } = useNostr()

  useEffect(() => {
    const init = async () => {
      if (!pubkey) return
      const relayList = await client.fetchRelayList(pubkey)
      const events = await client.fetchEvents(relayList.write.slice(0, 4), [
        {
          authors: [pubkey],
          kinds: [kinds.Reaction, kinds.Repost],
          limit: 100
        },
        {
          '#P': [pubkey],
          kinds: [kinds.Zap],
          limit: 100
        }
      ])
      updateNoteStatsByEvents(events)
    }
    init()
  }, [pubkey])

  const fetchNoteStats = async (event: Event) => {
    const oldStats = noteStatsMap.get(event.id)
    let since: number | undefined
    if (oldStats?.updatedAt) {
      since = oldStats.updatedAt
    }
    const [relayList, authorProfile] = await Promise.all([
      client.fetchRelayList(event.pubkey),
      client.fetchProfile(event.pubkey)
    ])
    const filters: Filter[] = [
      {
        '#e': [event.id],
        kinds: [kinds.Reaction],
        limit: 500
      },
      {
        '#e': [event.id],
        kinds: [kinds.Repost],
        limit: 100
      }
    ]

    if (authorProfile?.lightningAddress) {
      filters.push({
        '#e': [event.id],
        kinds: [kinds.Zap],
        limit: 500
      })
    }

    if (pubkey) {
      filters.push({
        '#e': [event.id],
        authors: [pubkey],
        kinds: [kinds.Reaction, kinds.Repost]
      })

      if (authorProfile?.lightningAddress) {
        filters.push({
          '#e': [event.id],
          '#P': [pubkey],
          kinds: [kinds.Zap]
        })
      }
    }

    if (since) {
      filters.forEach((filter) => {
        filter.since = since
      })
    }
    const events = await client.fetchEvents(relayList.read.slice(0, 4), filters)
    updateNoteStatsByEvents(events)
    let stats: Partial<TNoteStats> | undefined
    setNoteStatsMap((prev) => {
      const old = prev.get(event.id) || {}
      prev.set(event.id, { ...old, updatedAt: dayjs().unix() })
      stats = prev.get(event.id)
      return new Map(prev)
    })
    return stats
  }

  const updateNoteStatsByEvents = (events: Event[]) => {
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
    setNoteStatsMap((prev) => {
      newRepostsMap.forEach((newReposts, eventId) => {
        const old = prev.get(eventId) || {}
        const reposts = old.reposts || new Set()
        newReposts.forEach((repost) => reposts.add(repost))
        prev.set(eventId, { ...old, reposts })
      })
      newLikesMap.forEach((newLikes, eventId) => {
        const old = prev.get(eventId) || {}
        const likes = old.likes || []
        newLikes.forEach((like) => {
          const exists = likes.find((l) => l.id === like.id)
          if (!exists) {
            likes.push(like)
          }
        })
        likes.sort((a, b) => b.created_at - a.created_at)
        prev.set(eventId, { ...old, likes })
      })
      newZapsMap.forEach((newZaps, eventId) => {
        const old = prev.get(eventId) || {}
        const zaps = old.zaps || []
        const exists = new Set(zaps.map((zap) => zap.pr))
        newZaps.forEach((zap) => {
          if (!exists.has(zap.pr)) {
            exists.add(zap.pr)
            zaps.push(zap)
          }
        })
        zaps.sort((a, b) => b.amount - a.amount)
        prev.set(eventId, { ...old, zaps })
      })
      return new Map(prev)
    })
    return
  }

  const updateNoteReplyCount = (noteId: string, replyCount: number) => {
    setNoteStatsMap((prev) => {
      const old = prev.get(noteId)
      if (!old) {
        prev.set(noteId, { replyCount })
        return new Map(prev)
      } else if (old.replyCount === undefined || old.replyCount < replyCount) {
        prev.set(noteId, { ...old, replyCount })
        return new Map(prev)
      }
      return prev
    })
  }

  const addZap = (eventId: string, pr: string, amount: number, comment?: string) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const zaps = old?.zaps || []
      prev.set(eventId, {
        ...old,
        zaps: [...zaps, { pr, pubkey, amount, comment }].sort((a, b) => b.amount - a.amount)
      })
      return new Map(prev)
    })
  }

  return (
    <NoteStatsContext.Provider
      value={{
        noteStatsMap,
        fetchNoteStats,
        updateNoteReplyCount,
        addZap,
        updateNoteStatsByEvents
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
