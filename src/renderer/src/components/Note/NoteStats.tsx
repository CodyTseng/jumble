import { cn } from '@renderer/lib/utils'
import { useNoteStats } from '@renderer/providers/NoteStatsProvider'
import { Heart, MessageCircle, Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo } from 'react'
import NoteOptionsTrigger from './NoteOptionsTrigger'

export default function NoteStats({
  event,
  className,
  fetchIfNotExisting = false
}: {
  event: Event
  className?: string
  fetchIfNotExisting?: boolean
}) {
  const { noteStatsMap, loadNoteLikeAndRepostStats, loadHasLikedOrReposted } = useNoteStats()
  const stats = useMemo(() => noteStatsMap.get(event.id) ?? {}, [noteStatsMap, event.id])

  useEffect(() => {
    if (
      fetchIfNotExisting &&
      (stats.reactionCount === undefined || stats.repostCount === undefined)
    ) {
      loadNoteLikeAndRepostStats(event.id)
    }
    if (fetchIfNotExisting && (stats.hasLiked === undefined || stats.hasReposted === undefined)) {
      loadHasLikedOrReposted(event.id)
    }
  }, [])

  return (
    <div className={cn('flex justify-between', className)}>
      <div className="flex gap-4 h-4 items-center">
        <div className="flex gap-1 items-center text-muted-foreground">
          <MessageCircle size={14} />
          <div className="text-xs">{formatCount(stats.replyCount)}</div>
        </div>
        <RepostButton hasReposted={stats.hasReposted} repostCount={stats.repostCount} />
        <LikeButton hasLiked={stats.hasLiked} reactionCount={stats.reactionCount} />
      </div>
      <NoteOptionsTrigger event={event} />
    </div>
  )
}

function RepostButton({ hasReposted = false, repostCount = 0 }) {
  return (
    <div
      className={`flex gap-1 items-center text-muted-foreground ${hasReposted ? 'text-lime-500' : ''}`}
    >
      <Repeat size={14} />
      <div className="text-xs">{formatCount(repostCount)}</div>
    </div>
  )
}

function LikeButton({
  hasLiked = false,
  reactionCount = 0
}: {
  hasLiked?: boolean
  reactionCount?: number
}) {
  return (
    <div
      className={`flex gap-1 items-center text-muted-foreground ${hasLiked ? 'text-red-400' : ''}`}
    >
      <Heart size={14} className={hasLiked ? 'fill-red-400' : ''} />
      <div className="text-xs">{formatCount(reactionCount)}</div>
    </div>
  )
}

function formatCount(count?: number) {
  if (count === undefined || count <= 0) return ''
  return count >= 100 ? '99+' : count
}
