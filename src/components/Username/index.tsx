import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { cn, isTouchDevice } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { TProfile } from '@/types'
import { useMemo } from 'react'
import ProfileCard from '../ProfileCard'
import TextWithEmojis from '../TextWithEmojis'
import RebrandIndicator from './RebrandIndicator'

// FollowListContext-style subscription lives in these children so a logged-out
// or npub-only session (canEdit === false) renders the plain path and never
// subscribes — keeps feeds full of Usernames from churning.
function SavedNameLabel({ profile, prefix }: { profile: TProfile; prefix: React.ReactNode }) {
  const { notes } = useContactNotes()
  const saved = notes.get(profile.pubkey)?.name
  return (
    <>
      {prefix}
      {saved ? (
        saved
      ) : (
        <TextWithEmojis text={profile.username} emojis={profile.emojis} emojiClassName="mb-1" />
      )}
    </>
  )
}

function PlainLabel({ profile, prefix }: { profile: TProfile; prefix: React.ReactNode }) {
  return (
    <>
      {prefix}
      <TextWithEmojis text={profile.username} emojis={profile.emojis} emojiClassName="mb-1" />
    </>
  )
}

function RebrandSlot({ profile }: { profile: TProfile }) {
  const { notes } = useContactNotes()
  const saved = notes.get(profile.pubkey)?.name
  if (!saved || saved === profile.username) return null
  return (
    <RebrandIndicator
      pubkey={profile.pubkey}
      storedName={saved}
      currentName={profile.username}
      className="ms-1 align-middle"
    />
  )
}

export default function Username({
  userId,
  showAt = false,
  className,
  skeletonClassName,
  withoutSkeleton = false
}: {
  userId: string
  showAt?: boolean
  className?: string
  skeletonClassName?: string
  withoutSkeleton?: boolean
}) {
  const { profile, isFetching } = useFetchProfile(userId)
  const { canEdit } = useContactNotes()
  const supportTouch = useMemo(() => isTouchDevice(), [])
  if (!profile && isFetching && !withoutSkeleton) {
    return (
      <div className="py-1">
        <Skeleton className={cn('w-16', skeletonClassName)} />
      </div>
    )
  }
  if (!profile) return null

  const prefix = showAt ? '@' : null

  const trigger = (
    <div dir="auto" className={className}>
      <SecondaryPageLink
        to={toProfile(userId)}
        className="truncate hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {canEdit ? (
          <SavedNameLabel profile={profile} prefix={prefix} />
        ) : (
          <PlainLabel profile={profile} prefix={prefix} />
        )}
      </SecondaryPageLink>
      {canEdit && <RebrandSlot profile={profile} />}
    </div>
  )

  if (supportTouch) {
    return trigger
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <ProfileCard userId={userId} />
      </HoverCardContent>
    </HoverCard>
  )
}

export function SimpleUsername({
  userId,
  showAt = false,
  className,
  skeletonClassName,
  withoutSkeleton = false
}: {
  userId: string
  showAt?: boolean
  className?: string
  skeletonClassName?: string
  withoutSkeleton?: boolean
}) {
  const { profile, isFetching } = useFetchProfile(userId)
  const { canEdit } = useContactNotes()
  if (!profile && isFetching && !withoutSkeleton) {
    return (
      <div className="py-1">
        <Skeleton className={cn('w-16', skeletonClassName)} />
      </div>
    )
  }
  if (!profile) return null

  const prefix = showAt ? '@' : null

  return (
    <div dir="auto" className={className}>
      {canEdit ? (
        <SavedNameLabel profile={profile} prefix={prefix} />
      ) : (
        <PlainLabel profile={profile} prefix={prefix} />
      )}
    </div>
  )
}
