import { useFetchProfile } from '@/hooks/useFetchProfile'
import { ParsedVideoData, formatViewCount } from '@/lib/divine-video'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import MediaPlayer from '../MediaPlayer'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { Skeleton } from '../ui/skeleton'
import { Eye, MessageCircle, Heart, Repeat2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useMemo } from 'react'
import { nip19 } from 'nostr-tools'

interface DivineVideoCardProps {
  video: ParsedVideoData
  className?: string
}

export default function DivineVideoCard({ video, className }: DivineVideoCardProps) {
  const { push } = useSecondaryPage()
  const { profile } = useFetchProfile(video.pubkey)

  // Use original Vine timestamp if available, otherwise use created_at
  const timestamp = video.originalVineTimestamp || video.createdAt
  const date = new Date(timestamp * 1000)

  // Format time - show actual date for old content, relative time for recent
  const timeAgo = useMemo(() => {
    const now = new Date()
    const yearsDiff = now.getFullYear() - date.getFullYear()

    if (yearsDiff > 1 || (yearsDiff === 1 && now.getTime() < new Date(date).setFullYear(date.getFullYear() + 1))) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
    return formatDistanceToNow(date, { addSuffix: true })
  }, [timestamp])

  const handleClick = () => {
    // Navigate to the note page using the original event
    push(toNote(nip19.neventEncode({ id: video.id })))
  }

  const displayName = profile?.display_name || profile?.name || video.pubkey.slice(0, 8) + '...'

  return (
    <div
      className={cn(
        'bg-card border-b hover:bg-muted/30 transition-colors cursor-pointer',
        className
      )}
      onClick={handleClick}
    >
      {/* Author info */}
      <div className="flex items-center gap-3 p-3 pb-2">
        <UserAvatar userId={video.pubkey} size="normal" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Username
              userId={video.pubkey}
              className="font-semibold text-sm hover:underline truncate"
            />
            {video.isVineMigrated && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                Vine
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground" title={date.toLocaleString()}>
            {timeAgo}
          </span>
        </div>
      </div>

      {/* Video content */}
      <div className="px-3">
        {/* Title */}
        {video.title && (
          <h3 className="font-semibold text-base mb-2 line-clamp-2">{video.title}</h3>
        )}

        {/* Description (if different from title) */}
        {video.content && video.content.trim() !== video.title?.trim() && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{video.content}</p>
        )}

        {/* Video player - autoplay with sound */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-2">
          <MediaPlayer
            src={video.videoUrl}
            className="w-full h-full object-contain"
            loop
            defaultMuted={false}
          />
        </div>

        {/* Hashtags */}
        {video.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {video.hashtags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="text-xs text-primary hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Navigate to hashtag search
                }}
              >
                #{tag}
              </span>
            ))}
            {video.hashtags.length > 5 && (
              <span className="text-xs text-muted-foreground">
                +{video.hashtags.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 px-3 py-2 text-muted-foreground text-xs border-t">
        {(video.loopCount ?? 0) > 0 && (
          <span className="flex items-center gap-1" title="Views/Loops">
            <Eye className="w-3.5 h-3.5" />
            {formatViewCount(video.loopCount!)}
          </span>
        )}
        {(video.likeCount ?? 0) > 0 && (
          <span className="flex items-center gap-1" title="Likes">
            <Heart className="w-3.5 h-3.5" />
            {formatViewCount(video.likeCount!)}
          </span>
        )}
        {(video.repostCount ?? 0) > 0 && (
          <span className="flex items-center gap-1" title="Reposts">
            <Repeat2 className="w-3.5 h-3.5" />
            {formatViewCount(video.repostCount!)}
          </span>
        )}
        {(video.commentCount ?? 0) > 0 && (
          <span className="flex items-center gap-1" title="Comments">
            <MessageCircle className="w-3.5 h-3.5" />
            {formatViewCount(video.commentCount!)}
          </span>
        )}
      </div>
    </div>
  )
}

export function DivineVideoCardSkeleton() {
  return (
    <div className="bg-card border-b p-3">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="aspect-square w-full rounded-lg mb-2" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}
