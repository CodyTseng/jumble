import { createReactionDraftEvent } from '@renderer/lib/draft-event'
import { cn } from '@renderer/lib/utils'
import { useNostr } from '@renderer/providers/NostrProvider'
import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import client from '@renderer/services/client.service'
import { Heart, Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
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
  const { pubkey, publish } = useNostr()
  const { noteStatsMap, fetchNoteLikedStatus, fetchNoteLikeCount, markNoteAsLiked } = useNoteStats()
  const [liking, setLiking] = useState(false)
  const { likeCount, hasLiked } = useMemo(
    () => noteStatsMap.get(event.id) ?? {},
    [noteStatsMap, event.id]
  )
  const canLike = pubkey && !hasLiked && !liking

  useEffect(() => {
    if (!canFetch) return

    if (likeCount === undefined) {
      fetchNoteLikeCount(event)
    }
    if (hasLiked === undefined) {
      fetchNoteLikedStatus(event)
    }
  }, [])

  const like = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canLike) return

    setLiking(true)
    const timer = setTimeout(() => setLiking(false), 5000)

    try {
      const [liked] = await Promise.all([
        hasLiked === undefined ? fetchNoteLikedStatus(event) : hasLiked,
        likeCount === undefined ? fetchNoteLikeCount(event) : likeCount
      ])
      if (liked) return

      const targetRelayList = await client.fetchRelayList(event.pubkey)
      const reaction = createReactionDraftEvent(event)
      await publish(reaction, targetRelayList.read.slice(0, 3))
      markNoteAsLiked(event.id)
    } catch (error) {
      console.error('like failed', error)
    } finally {
      setLiking(false)
      clearTimeout(timer)
    }
  }

  return (
    <button
      className={cn(
        'flex items-center enabled:hover:text-red-400',
        variant === 'normal' ? 'gap-1' : 'flex-col',
        hasLiked ? 'text-red-400' : 'text-muted-foreground'
      )}
      onClick={like}
      disabled={!canLike}
      title="like"
    >
      {liking ? (
        <Loader className="animate-spin" size={16} />
      ) : (
        <Heart size={16} className={hasLiked ? 'fill-red-400' : ''} />
      )}
      <div className="text-xs">{formatCount(likeCount)}</div>
    </button>
  )
}
