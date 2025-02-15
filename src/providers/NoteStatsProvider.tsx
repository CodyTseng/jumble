import { tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import { Invoice } from '@getalby/lightning-tools'
import { Event, Filter, kinds } from 'nostr-tools'
import { createContext, useContext, useState } from 'react'
import { useNostr } from './NostrProvider'

export type TNoteStats = {
  likes: Set<string>
  reposts: Set<string>
  zaps: { pr: string; pubkey: string; amount: number }[]
  replyCount: number
}

type TNoteStatsContext = {
  noteStatsMap: Map<string, Partial<TNoteStats>>
  updateNoteReplyCount: (noteId: string, replyCount: number) => void
  addLike: (eventId: string) => void
  addRepost: (eventId: string) => void
  addZap: (eventId: string, pr: string, amount: number) => void
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

  const fetchNoteStats = async (event: Event) => {
    const relayList = await client.fetchRelayList(event.pubkey)
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
      },
      {
        '#e': [event.id],
        kinds: [kinds.Zap],
        limit: 500
      }
    ]

    if (pubkey) {
      filters.push(
        ...[
          {
            '#e': [event.id],
            authors: [pubkey],
            kinds: [kinds.Reaction, kinds.Repost]
          },
          {
            '#e': [event.id],
            '#P': [pubkey],
            kinds: [kinds.Zap]
          }
        ]
      )
    }

    const events = await client.fetchEvents(relayList.read.slice(0, 3), filters)
    const likesMap = new Map<string, Set<string>>()
    const reposts = new Set<string>()
    const zaps: { pr: string; pubkey: string; amount: number }[] = []
    events.forEach((evt) => {
      if (evt.kind === kinds.Repost) {
        reposts.add(evt.pubkey)
        return
      }

      if (evt.kind === kinds.Reaction) {
        const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
        if (targetEventId) {
          const likes = likesMap.get(targetEventId) || new Set()
          likes.add(evt.pubkey)
          likesMap.set(targetEventId, likes)
        }
      }

      if (evt.kind === kinds.Zap) {
        const sender = evt.tags.find(tagNameEquals('P'))?.[1]
        if (!sender) return
        const pr = evt.tags.find(tagNameEquals('bolt11'))?.[1]
        if (!pr) return
        const invoice = new Invoice({ pr }) // TODO: need to validate
        const amount = invoice.satoshi
        zaps.push({ pr, pubkey: sender, amount })
      }
    })
    let stats: Partial<TNoteStats> | undefined
    setNoteStatsMap((prev) => {
      const newMap = new Map(prev)
      for (const [eventId, newLikes] of likesMap) {
        const old = newMap.get(eventId) || {}
        const oldLikes = old.likes || new Set()
        oldLikes.forEach((like) => newLikes.add(like))
        newMap.set(eventId, { ...old, likes: newLikes })
      }
      const old = newMap.get(event.id) || {}
      const oldReposts = old.reposts || new Set()
      const oldZaps = old.zaps || []
      reposts.forEach((repost) => oldReposts.add(repost))
      zaps.forEach((zap) => {
        if (!oldZaps.find((oldZap) => oldZap.pr === zap.pr)) {
          oldZaps.push(zap)
        }
      })
      newMap.set(event.id, { ...old, reposts, zaps })
      stats = newMap.get(event.id)
      return newMap
    })
    return stats
  }

  const updateNoteReplyCount = (noteId: string, replyCount: number) => {
    setNoteStatsMap((prev) => {
      const old = prev.get(noteId)
      if (!old) {
        return new Map(prev).set(noteId, { replyCount })
      } else if (old.replyCount === undefined || old.replyCount < replyCount) {
        return new Map(prev).set(noteId, { ...old, replyCount })
      }
      return prev
    })
  }

  const addLike = (eventId: string) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const likes = new Set(old?.likes ?? [])
      likes.add(pubkey)
      return new Map(prev).set(eventId, { ...old, likes })
    })
  }

  const addRepost = (eventId: string) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const reposts = new Set(old?.reposts ?? [])
      reposts.add(pubkey)
      return new Map(prev).set(eventId, { ...old, reposts })
    })
  }

  const addZap = (eventId: string, pr: string, amount: number) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const zaps = old?.zaps || []
      return new Map(prev).set(eventId, {
        ...old,
        zaps: [...zaps, { pr, pubkey, amount }]
      })
    })
  }

  return (
    <NoteStatsContext.Provider
      value={{
        noteStatsMap,
        fetchNoteStats,
        updateNoteReplyCount,
        addLike,
        addRepost,
        addZap
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
