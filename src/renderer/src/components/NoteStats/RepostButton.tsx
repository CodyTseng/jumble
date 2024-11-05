import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import { Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo } from 'react'
import { formatCount } from './utils'

export default function RepostButton({
  event,
  canFetch = false
}: {
  event: Event
  canFetch?: boolean
}) {
  const { noteStatsMap, fetchNoteRepostCount, fetchNoteRepostedStatus } = useNoteStats()
  const { repostCount, hasReposted } = useMemo(
    () => noteStatsMap.get(event.id) ?? {},
    [noteStatsMap, event.id]
  )

  useEffect(() => {
    if (!canFetch) return

    if (repostCount === undefined) {
      fetchNoteRepostCount(event)
    }
    if (hasReposted === undefined) {
      fetchNoteRepostedStatus(event)
    }
  }, [])

  return (
    <div
      className={`flex gap-1 items-center ${hasReposted ? 'text-lime-500' : 'text-muted-foreground'}`}
    >
      <Repeat size={16} />
      <div className="text-xs">{formatCount(repostCount)}</div>
    </div>
  )
}
