import { getAmountFromInvoice } from '@/lib/lightning'
import { tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { createContext, useContext, useState } from 'react'
import { useNostr } from './NostrProvider'

export type TNoteStats = {
  likes: Set<string>
  reposts: Set<string>
  zaps: { pr: string; pubkey: string; amount: number }[]
  replyCount: number
  updatedAt?: number
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
    const oldStats = noteStatsMap.get(event.id)
    let since: number | undefined
    if (oldStats?.updatedAt) {
      since = oldStats.updatedAt
    }
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

    if (since) {
      filters.forEach((filter) => {
        filter.since = since
      })
    }
    await client.fetchEvents(relayList.read.slice(0, 3), filters, {
      onevent: (evt) => {
        if (evt.kind === kinds.Repost) {
          return setNoteStatsMap((prev) => {
            const old = prev.get(event.id) || {}
            const reposts = old?.reposts ?? new Set()
            reposts.add(evt.pubkey)
            prev.set(event.id, { ...old, reposts })
            return new Map(prev)
          })
        }

        if (evt.kind === kinds.Reaction) {
          const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
          if (targetEventId) {
            return setNoteStatsMap((prev) => {
              const old = prev.get(targetEventId) || {}
              const likes = old?.likes ?? new Set()
              likes.add(evt.pubkey)
              prev.set(targetEventId, { ...old, likes })
              return new Map(prev)
            })
          }
        }

        if (evt.kind === kinds.Zap) {
          const sender = evt.tags.find(tagNameEquals('P'))?.[1]
          if (!sender) return
          const pr = evt.tags.find(tagNameEquals('bolt11'))?.[1]
          if (!pr) return
          const amount = getAmountFromInvoice(pr)
          return setNoteStatsMap((prev) => {
            const old = prev.get(event.id) || {}
            const zaps = old?.zaps ?? []
            zaps.push({ pr, pubkey: sender, amount })
            prev.set(event.id, { ...old, zaps })
            return new Map(prev)
          })
        }
      }
    })
    let stats: Partial<TNoteStats> | undefined
    setNoteStatsMap((prev) => {
      const old = prev.get(event.id) || {}
      prev.set(event.id, { ...old, updatedAt: dayjs().unix() })
      stats = prev.get(event.id)
      return new Map(prev)
    })
    return stats
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

  const addLike = (eventId: string) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const likes = new Set(old?.likes ?? [])
      likes.add(pubkey)
      prev.set(eventId, { ...old, likes })
      return new Map(prev)
    })
  }

  const addRepost = (eventId: string) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const reposts = new Set(old?.reposts ?? [])
      reposts.add(pubkey)
      prev.set(eventId, { ...old, reposts })
      return new Map(prev)
    })
  }

  const addZap = (eventId: string, pr: string, amount: number) => {
    if (!pubkey) return
    setNoteStatsMap((prev) => {
      const old = prev.get(eventId)
      const zaps = old?.zaps || []
      prev.set(eventId, {
        ...old,
        zaps: [...zaps, { pr, pubkey, amount }]
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
        addLike,
        addRepost,
        addZap
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
