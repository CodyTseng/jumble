import { cn } from '@/lib/utils'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useEffect } from 'react'
import BookmarkButton from '../BookmarkButton'
import LikeButton from './LikeButton'
import ReplyButton from './ReplyButton'
import RepostButton from './RepostButton'
import SeenOnButton from './SeenOnButton'
import TopZaps from './TopZaps'
import ZapButton from './ZapButton'

export default function NoteStats({
  event,
  className,
  classNames,
  fetchIfNotExisting = false,
  variant = 'note'
}: {
  event: Event
  className?: string
  classNames?: {
    buttonBar?: string
  }
  fetchIfNotExisting?: boolean
  variant?: 'note' | 'reply'
}) {
  const { isSmallScreen } = useScreenSize()
  const { fetchNoteStats } = useNoteStats()

  useEffect(() => {
    if (!fetchIfNotExisting) return
    fetchNoteStats(event)
  }, [event, fetchIfNotExisting])

  if (isSmallScreen) {
    return (
      <div className={cn('select-none', className)}>
        <TopZaps event={event} />
        <div
          className={cn(
            'flex justify-between items-center h-5 [&_svg]:size-5',
            classNames?.buttonBar
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <ReplyButton event={event} variant={variant} />
          <RepostButton event={event} />
          <LikeButton event={event} />
          <ZapButton event={event} />
          <BookmarkButton event={event} />
          <SeenOnButton event={event} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('select-none', className)}>
      <TopZaps event={event} />
      <div className="flex justify-between h-5 [&_svg]:size-4">
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <ReplyButton event={event} variant={variant} />
          <RepostButton event={event} />
          <LikeButton event={event} />
          <ZapButton event={event} />
          <BookmarkButton event={event} />
        </div>
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <SeenOnButton event={event} />
        </div>
      </div>
    </div>
  )
}
