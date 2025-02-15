import { createReactionDraftEvent } from '@/lib/draft-event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import { Heart, Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCount } from './utils'

export default function LikeButton({
  event,
  canFetch = false
}: {
  event: Event
  canFetch?: boolean
}) {
  const { t } = useTranslation()
  const { publish, checkLogin } = useNostr()
  const { noteStatsMap, fetchNoteLikedStatus, fetchNoteLikeCount, markNoteAsLiked } = useNoteStats()
  const [liking, setLiking] = useState(false)
  const { likeCount, hasLiked } = useMemo(
    () => noteStatsMap.get(event.id) ?? {},
    [noteStatsMap, event.id]
  )
  const canLike = !hasLiked && !liking

  useEffect(() => {
    if (!canFetch) return

    if (likeCount === undefined) {
      fetchNoteLikeCount(event)
    }
    if (hasLiked === undefined) {
      fetchNoteLikedStatus(event)
    }
  }, [canFetch, event])

  const like = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
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
        await publish(reaction, { additionalRelayUrls: targetRelayList.read.slice(0, 4) })
        markNoteAsLiked(event.id)
      } catch (error) {
        console.error('like failed', error)
      } finally {
        setLiking(false)
        clearTimeout(timer)
      }
    })
  }

  return (
    <button
      className={cn(
        'flex items-center enabled:hover:text-red-400 gap-1',
        hasLiked ? 'text-red-400' : 'text-muted-foreground'
      )}
      onClick={like}
      disabled={!canLike}
      title={t('Like')}
    >
      {liking ? (
        <Loader className="animate-spin" size={16} />
      ) : (
        <Heart size={16} className={hasLiked ? 'fill-red-400' : ''} />
      )}
      {!!likeCount && <div className="text-sm">{formatCount(likeCount)}</div>}
    </button>
  )
}
