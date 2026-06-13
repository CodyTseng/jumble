import { useRepostTarget } from '@/hooks'
import { isMentioningMutedUsers } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import MainNoteCard from './MainNoteCard'

export default function RepostNoteCard({
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
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { targetEvent } = useRepostTarget(event)
  const shouldHide = useMemo(() => {
    if (!targetEvent) return true
    if (filterMutedNotes && mutePubkeySet.has(targetEvent.pubkey)) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(targetEvent, mutePubkeySet)) {
      return true
    }
    return false
  }, [targetEvent, filterMutedNotes, hideContentMentioningMutedUsers, mutePubkeySet])

  if (!targetEvent || shouldHide) return null

  return (
    <MainNoteCard
      className={className}
      reposters={
        reposters?.includes(event.pubkey) ? reposters : [event.pubkey].concat(reposters ?? [])
      }
      event={targetEvent}
      pinned={pinned}
    />
  )
}
