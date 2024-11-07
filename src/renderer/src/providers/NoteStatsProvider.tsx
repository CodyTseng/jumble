import { tagNameEquals } from '@renderer/lib/tag'
import client from '@renderer/services/client.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

export type TNoteStats = {
  likeCount: number
  repostCount: number
  replyCount: number
  hasLiked: boolean
  hasReposted: boolean
}

type TNoteStatsContext = {
  noteStatsMap: Map<string, Partial<TNoteStats>>
  updateNoteReplyCount: (noteId: string, replyCount: number) => void
  markNoteAsLiked: (noteId: string) => void
  markNoteAsReposted: (noteId: string) => void
  fetchNoteLikeCount: (event: Event) => Promise<number>
  fetchNoteRepostCount: (event: Event) => Promise<number>
  fetchNoteLikedStatus: (event: Event) => Promise<boolean>
  fetchNoteRepostedStatus: (event: Event) => Promise<boolean>
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
    setNoteStatsMap((prev) => {
      const newMap = new Map()
      for (const [noteId, stats] of prev) {
        newMap.set(noteId, { ...stats, hasLiked: undefined, hasReposted: undefined })
      }
      return newMap
    })
  }, [pubkey])

  const fetchNoteLikeCount = async (event: Event) => {
    const relayList = await client.fetchRelayList(event.pubkey)
    const events = await client.fetchEvents(relayList.read, {
      '#e': [event.id],
      kinds: [kinds.Reaction],
      limit: 500
    })
    const countMap = new Map<string, number>()
    for (const e of events) {
      const targetEventId = e.tags.findLast(tagNameEquals('e'))?.[1]
      if (targetEventId) {
        countMap.set(targetEventId, (countMap.get(targetEventId) || 0) + 1)
      }
    }
    setNoteStatsMap((prev) => {
      const newMap = new Map(prev)
      for (const [eventId, count] of countMap) {
        const old = prev.get(eventId)
        newMap.set(eventId, old ? { ...old, likeCount: count } : { likeCount: count })
      }
      return newMap
    })
    return countMap.get(event.id) || 0
  }

  const fetchNoteRepostCount = async (event: Event) => {
    const relayList = await client.fetchRelayList(event.pubkey)
    const events = await client.fetchEvents(relayList.read, {
      '#e': [event.id],
      kinds: [kinds.Repost],
      limit: 100
    })
    setNoteStatsMap((prev) => {
      const newMap = new Map(prev)
      const old = prev.get(event.id)
      newMap.set(
        event.id,
        old ? { ...old, repostCount: events.length } : { repostCount: events.length }
      )
      return newMap
    })
    return events.length
  }

  const fetchNoteLikedStatus = async (event: Event) => {
    if (!pubkey) return false

    const relayList = await client.fetchRelayList(pubkey)
    const events = await client.fetchEvents(relayList.write, {
      '#e': [event.id],
      authors: [pubkey],
      kinds: [kinds.Reaction]
    })
    const likedEventIds = events
      .map((e) => e.tags.findLast(tagNameEquals('e'))?.[1])
      .filter(Boolean) as string[]

    setNoteStatsMap((prev) => {
      const newMap = new Map(prev)
      likedEventIds.forEach((eventId) => {
        const old = newMap.get(eventId)
        newMap.set(eventId, old ? { ...old, hasLiked: true } : { hasLiked: true })
      })
      if (!likedEventIds.includes(event.id)) {
        const old = newMap.get(event.id)
        newMap.set(event.id, old ? { ...old, hasLiked: false } : { hasLiked: false })
      }
      return newMap
    })
    return likedEventIds.includes(event.id)
  }

  const fetchNoteRepostedStatus = async (event: Event) => {
    if (!pubkey) return false

    const relayList = await client.fetchRelayList(pubkey)
    const events = await client.fetchEvents(relayList.write, {
      '#e': [event.id],
      authors: [pubkey],
      kinds: [kinds.Repost]
    })

    setNoteStatsMap((prev) => {
      const hasReposted = events.length > 0
      const newMap = new Map(prev)
      const old = prev.get(event.id)
      newMap.set(event.id, old ? { ...old, hasReposted } : { hasReposted })
      return newMap
    })
    return events.length > 0
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

  const markNoteAsLiked = (noteId: string) => {
    setNoteStatsMap((prev) => {
      const old = prev.get(noteId)
      return new Map(prev).set(
        noteId,
        old
          ? { ...old, hasLiked: true, likeCount: (old.likeCount ?? 0) + 1 }
          : { hasLiked: true, likeCount: 1 }
      )
    })
  }

  const markNoteAsReposted = (noteId: string) => {
    setNoteStatsMap((prev) => {
      const old = prev.get(noteId)
      return new Map(prev).set(
        noteId,
        old
          ? { ...old, hasReposted: true, repostCount: (old.repostCount ?? 0) + 1 }
          : { hasReposted: true, repostCount: 1 }
      )
    })
  }

  return (
    <NoteStatsContext.Provider
      value={{
        noteStatsMap,
        fetchNoteLikeCount,
        fetchNoteLikedStatus,
        fetchNoteRepostCount,
        fetchNoteRepostedStatus,
        updateNoteReplyCount,
        markNoteAsLiked,
        markNoteAsReposted
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
