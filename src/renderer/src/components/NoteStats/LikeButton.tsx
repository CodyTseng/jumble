import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import { Heart } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo } from 'react'
import { formatCount } from './utils'

export default function LikeButton({
  event,
  variant = 'normal',
  canFetch = false
}: {
  event: Event
  variant?: 'normal' | 'reply'
  canFetch?: boolean
}) {
  const { noteStatsMap, fetchNoteLikedStatus, fetchNoteLikeCount } = useNoteStats()
  const { likeCount, hasLiked } = useMemo(
    () => noteStatsMap.get(event.id) ?? {},
    [noteStatsMap, event.id]
  )

  useEffect(() => {
    if (!canFetch) return

    if (likeCount === undefined) {
      fetchNoteLikeCount(event)
    }
    if (hasLiked === undefined) {
      fetchNoteLikedStatus(event)
    }
  }, [])

  return (
    <div
      className={`flex items-center ${variant === 'normal' ? 'gap-1' : 'flex-col'} ${hasLiked ? 'text-red-400' : 'text-muted-foreground'}`}
    >
      <Heart size={16} className={hasLiked ? 'fill-red-400' : ''} />
      <div className="text-xs">{formatCount(likeCount)}</div>
    </div>
  )
}
