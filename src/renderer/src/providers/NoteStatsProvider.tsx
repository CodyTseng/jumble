import client from '@renderer/services/client.service'
import { TEventStats } from '@renderer/types'
import { createContext, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

type TNoteStatsContext = {
  noteStatsMap: Map<string, Partial<TEventStats>>
  updateNoteReplyCount: (noteId: string, replyCount: number) => void
  loadNoteLikeAndRepostStats: (noteId: string) => Promise<void>
  loadHasLikedOrReposted: (noteId: string) => Promise<void>
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
  const [noteStatsMap, setNoteStatsMap] = useState<Map<string, Partial<TEventStats>>>(new Map())
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

  const loadNoteLikeAndRepostStats = async (noteId: string) => {
    const stats = await client.fetchNoteLikeAndRepostStats(noteId)
    setNoteStatsMap((prev) => {
      const old = prev.get(noteId)
      if (old) {
        return new Map(prev).set(noteId, { ...old, ...stats })
      }
      return new Map(prev).set(noteId, stats)
    })
  }

  const loadHasLikedOrReposted = async (noteId: string) => {
    if (!pubkey) return

    const stats = await client.fetchHasLikedOrReposted(noteId, pubkey)
    setNoteStatsMap((prev) => {
      const old = prev.get(noteId)
      if (old) {
        return new Map(prev).set(noteId, { ...old, ...stats })
      }
      return new Map(prev).set(noteId, stats)
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
        loadNoteLikeAndRepostStats,
        loadHasLikedOrReposted,
        updateNoteReplyCount
      }}
    >
      {children}
    </NoteStatsContext.Provider>
  )
}
