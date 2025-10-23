import { Skeleton } from '@/components/ui/skeleton'
import { isMentioningMutedUsers } from '@/lib/event'
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
  pinned = false
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
  pinned?: boolean
}) {
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const shouldHide = useMemo(() => {
    if (filterMutedNotes && mutePubkeySet.has(event.pubkey)) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) {
      return true
    }
    return false
  }, [event, filterMutedNotes, mutePubkeySet])
  if (shouldHide) return null

  if (event.kind === kinds.Repost) {
    return (
      <RepostNoteCard
        event={event}
        className={className}
        filterMutedNotes={filterMutedNotes}
        pinned={pinned}
      />
    )
  }
  return <MainNoteCard event={event} className={className} pinned={pinned} />
}

export function NoteCardLoadingSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center space-x-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className={`flex-1 w-0`}>
          <div className="py-1">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="py-0.5">
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <div className="my-1">
          <Skeleton className="w-full h-4 my-1 mt-2" />
        </div>
        <div className="my-1">
          <Skeleton className="w-2/3 h-4 my-1" />
        </div>
      </div>
    </div>
  )
}
