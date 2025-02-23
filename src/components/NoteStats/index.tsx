import { cn } from '@/lib/utils'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { Event } from 'nostr-tools'
import { useEffect } from 'react'
import LikeButton from './LikeButton'
import NoteOptions from './NoteOptions'
import ReplyButton from './ReplyButton'
import RepostButton from './RepostButton'
import SeenOnButton from './SeenOnButton'
import TopZaps from './TopZaps'
import ZapButton from './ZapButton'

export default function NoteStats({
  event,
  className,
  fetchIfNotExisting = false,
  variant = 'note'
}: {
  event: Event
  className?: string
  fetchIfNotExisting?: boolean
  variant?: 'note' | 'reply'
}) {
  const { fetchNoteStats } = useNoteStats()

  useEffect(() => {
    if (!fetchIfNotExisting) return
    fetchNoteStats(event)
  }, [event, fetchIfNotExisting])

  return (
    <div className={cn('select-none', className)}>
      <TopZaps event={event} />
      <div className="flex justify-between">
        <div className="flex gap-5 h-4 items-center" onClick={(e) => e.stopPropagation()}>
          <ReplyButton event={event} variant={variant} />
          <RepostButton event={event} />
          <LikeButton event={event} />
          <ZapButton event={event} />
        </div>
        <div className="flex gap-5 h-4 items-center" onClick={(e) => e.stopPropagation()}>
          <SeenOnButton event={event} />
          <NoteOptions event={event} />
        </div>
      </div>
    </div>
  )
}
