import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { formatCount } from './utils'

export default function ReplyButton({ event }: { event: Event }) {
  const { noteStatsMap } = useNoteStats()
  const { replyCount } = useMemo(() => noteStatsMap.get(event.id) ?? {}, [noteStatsMap, event.id])

  return (
    <div className="flex gap-1 items-center text-muted-foreground">
      <MessageCircle size={16} />
      <div className="text-xs">{formatCount(replyCount)}</div>
    </div>
  )
}
