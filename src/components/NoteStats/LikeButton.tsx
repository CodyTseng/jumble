import { createReactionDraftEvent } from '@/lib/draft-event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import { Heart, Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCount } from './utils'

export default function LikeButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { pubkey, publish, checkLogin } = useNostr()
  const { noteStatsMap, updateNoteStatsByEvents, fetchNoteStats } = useNoteStats()
  const [liking, setLiking] = useState(false)
  const { likeCount, hasLiked } = useMemo(() => {
    const stats = noteStatsMap.get(event.id) || {}
    return { likeCount: stats.likes?.size, hasLiked: pubkey ? stats.likes?.has(pubkey) : false }
  }, [noteStatsMap, event, pubkey])
  const canLike = !hasLiked && !liking

  const like = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!canLike || !pubkey) return

      setLiking(true)
      const timer = setTimeout(() => setLiking(false), 5000)

      try {
        const noteStats = noteStatsMap.get(event.id)
        const hasLiked = noteStats?.likes?.has(pubkey)
        if (hasLiked) return
        if (!noteStats?.updatedAt) {
          const stats = await fetchNoteStats(event)
          if (stats?.likes?.has(pubkey)) return
        }

        const targetRelayList = await client.fetchRelayList(event.pubkey)
        const reaction = createReactionDraftEvent(event)
        const evt = await publish(reaction, {
          additionalRelayUrls: targetRelayList.read.slice(0, 4)
        })
        updateNoteStatsByEvents([evt])
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
        'flex items-center enabled:hover:text-red-400 gap-1 px-3 h-full',
        hasLiked ? 'text-red-400' : 'text-muted-foreground'
      )}
      onClick={like}
      disabled={!canLike}
      title={t('Like')}
    >
      {liking ? (
        <Loader className="animate-spin" />
      ) : (
        <Heart className={hasLiked ? 'fill-red-400' : ''} />
      )}
      {!!likeCount && <div className="text-sm">{formatCount(likeCount)}</div>}
    </button>
  )
}
