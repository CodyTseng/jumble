import noteStats from '@/services/note-stats.service'
import { useSyncExternalStore } from 'react'

export function useNoteStatsById(noteId: string) {
  return useSyncExternalStore(
    (cb) => noteStats.subscribeNoteStats(noteId, cb),
    () => noteStats.getNoteStats(noteId)
  )
}
