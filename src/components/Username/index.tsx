import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { cn, isTouchDevice } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TProfile } from '@/types'
import { useMemo } from 'react'
import ProfileCard from '../ProfileCard'
import TextWithEmojis from '../TextWithEmojis'
import RebrandIndicator from './RebrandIndicator'

// Subscribes to the (memoized) contact-notes context. Kept in a child so the
// plain path (logged out / npub) never subscribes — avoids feed-wide churn.
// Default: show the CURRENT broadcast name + a hint mark when a saved name
// differs. Opt-in (preferSavedContactNames): show the saved name instead.
function DecoratedLabel({ profile, prefix }: { profile: TProfile; prefix: React.ReactNode }) {
  const { names } = useContactNotes()
  const { preferSavedContactNames } = useUserPreferences()
  const saved = names.get(profile.pubkey)
  const mismatch = !!saved && saved !== profile.username

  return (
    <>
      {prefix}
      {preferSavedContactNames && saved ? (
        saved
      ) : (
        <TextWithEmojis text={profile.username} emojis={profile.emojis} emojiClassName="mb-1" />
      )}
      {mismatch && (
        <RebrandIndicator
          pubkey={profile.pubkey}
          savedName={saved}
          currentName={profile.username}
          showingSaved={preferSavedContactNames}
          className="ms-1 align-middle"
        />
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
          <DecoratedLabel profile={profile} prefix={prefix} />
        ) : (
          <PlainLabel profile={profile} prefix={prefix} />
        )}
      </SecondaryPageLink>
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
        <DecoratedLabel profile={profile} prefix={prefix} />
      ) : (
        <PlainLabel profile={profile} prefix={prefix} />
      )}
    </div>
  )
}
