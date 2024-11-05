import client from '@renderer/services/client.service'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'
import { Event, kinds } from 'nostr-tools'

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
  fetchNoteLikeCount: (event: Event) => Promise<void>
  fetchNoteRepostCount: (event: Event) => Promise<void>
  fetchNoteLikedStatus: (event: Event) => Promise<void>
  fetchNoteRepostedStatus: (event: Event) => Promise<void>
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
    const events = await client.fetchEvents({
      '#e': [event.id],
      kinds: [kinds.Reaction],
      limit: 500
    })
    const countMap = new Map<string, number>()
    for (const e of events) {
      const targetEventId = e.tags.find(
        ([tagName, , , type]) => tagName === 'e' && type === undefined
      )?.[1]
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
  }

  const fetchNoteRepostCount = async (event: Event) => {
    const events = await client.fetchEvents({
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
  }

  const fetchNoteLikedStatus = async (event: Event) => {
    if (!pubkey) return

    const events = await client.fetchEvents({
      '#e': [event.id],
      authors: [pubkey],
      kinds: [kinds.Reaction]
    })
    const likedEventIds = events
      .map((e) => e.tags.find(([tagName, , , type]) => tagName === 'e' && type === undefined)?.[1])
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
  }

  const fetchNoteRepostedStatus = async (event: Event) => {
    if (!pubkey) return

    const events = await client.fetchEvents({
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

  return (
    <NoteStatsContext.Provider
      value={{
        noteStatsMap,
        fetchNoteLikeCount,
        fetchNoteLikedStatus,
        fetchNoteRepostCount,
        fetchNoteRepostedStatus,
        updateNoteReplyCount
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
