import { UserAvatarSkeleton } from '@/components/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { NSFW_DISPLAY_POLICY } from '@/constants'
import { isMentioningMutedUsers, isNsfwEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import MainNoteCard from './MainNoteCard'
import RepostNoteCard from './RepostNoteCard'

export default function NoteCard({
  event,
  className,
  filterMutedNotes = true,
  pinned = false,
  reposters
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
  pinned?: boolean
  reposters?: string[]
}) {
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers, nsfwDisplayPolicy } = useContentPolicy()
  const shouldHide = useMemo(() => {
    if (filterMutedNotes && mutePubkeySet.has(event.pubkey)) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) {
      return true
    }
    if (nsfwDisplayPolicy === NSFW_DISPLAY_POLICY.HIDE && isNsfwEvent(event)) {
      return true
    }
    return false
  }, [event, filterMutedNotes, mutePubkeySet, nsfwDisplayPolicy])
  if (shouldHide) return null

  if (event.kind === kinds.Repost || event.kind === kinds.GenericRepost) {
    return (
      <RepostNoteCard
        event={event}
        className={className}
        filterMutedNotes={filterMutedNotes}
        pinned={pinned}
        reposters={reposters}
      />
    )
  }
  return <MainNoteCard event={event} className={className} pinned={pinned} reposters={reposters} />
}

export function NoteCardLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('px-4 py-3', className)}>
      <div className="flex items-center gap-2">
        <UserAvatarSkeleton className="h-10 w-10" />
        <div className={`w-0 flex-1`}>
          <div className="py-1">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="py-0.5">
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <div className="my-1">
          <Skeleton className="my-1 mt-2 h-4 w-full" />
        </div>
        <div className="my-1">
          <Skeleton className="my-1 h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}
