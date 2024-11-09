import { useNostr } from '@renderer/providers/NostrProvider'
import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import PostDialog from '../PostDialog'
import { formatCount } from './utils'

export default function ReplyButton({ event }: { event: Event }) {
  const { noteStatsMap } = useNoteStats()
  const { pubkey } = useNostr()
  const { replyCount } = useMemo(() => noteStatsMap.get(event.id) ?? {}, [noteStatsMap, event.id])

  return (
    <PostDialog parentEvent={event}>
      <button
        className="flex gap-1 items-center text-muted-foreground enabled:hover:text-blue-400"
        disabled={!pubkey}
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle size={16} />
        <div className="text-xs">{formatCount(replyCount)}</div>
      </button>
    </PostDialog>
  )
}
