import { getAmountFromInvoice } from '@/lib/lightning'
import { tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
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
  addZap: (eventId: string, pr: string, amount: number) => void
  updateNoteStatsByEvent: (evt: Event) => void
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
    if (!pubkey) return
    const init = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // wait a bit to avoid concurrent too many requests
      const relayList = await client.fetchRelayList(pubkey)
      const filters: Filter[] = [
        {
          authors: [pubkey],
          kinds: [kinds.Repost, kinds.Reaction],
          limit: 1000
        },
        {
          '#P': [pubkey],
          kinds: [kinds.Zap],
          limit: 500
        }
      ]
      const events = await client.fetchEvents(relayList.write.slice(0, 4), filters)
      events.forEach(updateNoteStatsByEvent)
    }
    init()
  }, [pubkey])

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
      onevent: updateNoteStatsByEvent
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

  const updateNoteStatsByEvent = (evt: Event) => {
    if (evt.kind === kinds.Repost) {
      const eventId = evt.tags.find(tagNameEquals('e'))?.[1]
      if (!eventId) return
      setNoteStatsMap((prev) => {
        const old = prev.get(eventId) || {}
        const reposts = old?.reposts ?? new Set()
        reposts.add(evt.pubkey)
        prev.set(eventId, { ...old, reposts })
        return new Map(prev)
      })
      return
    }

    if (evt.kind === kinds.Reaction) {
      const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
      if (targetEventId) {
        setNoteStatsMap((prev) => {
          const old = prev.get(targetEventId) || {}
          const likes = old?.likes ?? new Set()
          likes.add(evt.pubkey)
          prev.set(targetEventId, { ...old, likes })
          return new Map(prev)
        })
        return
      }
    }

    if (evt.kind === kinds.Zap) {
      const eventId = evt.tags.find(tagNameEquals('e'))?.[1]
      if (!eventId) return
      const senderPubkey = evt.tags.find(tagNameEquals('P'))?.[1]
      if (!senderPubkey) return
      const pr = evt.tags.find(tagNameEquals('bolt11'))?.[1]
      if (!pr) return
      const amount = getAmountFromInvoice(pr)
      setNoteStatsMap((prev) => {
        const old = prev.get(eventId) || {}
        const zaps = old?.zaps ?? []
        zaps.push({ pr, pubkey: senderPubkey, amount })
        prev.set(eventId, { ...old, zaps })
        return new Map(prev)
      })
      return
    }
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
        addZap,
        updateNoteStatsByEvent
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
