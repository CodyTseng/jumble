import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import ProfileCard from '../ProfileCard'

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
  if (!profile && isFetching && !withoutSkeleton) {
    return (
      <div className="py-1">
        <Skeleton className={cn('w-16', skeletonClassName)} />
      </div>
    )
  }
  if (!profile) return null

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className={className}>
          <SecondaryPageLink
            to={toProfile(userId)}
            className="truncate hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {showAt && '@'}
            {profile.username}
          </SecondaryPageLink>
        </div>
      </HoverCardTrigger>
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
  if (!profile && isFetching && !withoutSkeleton) {
    return (
      <div className="py-1">
        <Skeleton className={cn('w-16', skeletonClassName)} />
      </div>
    )
  }
  if (!profile) return null

  const { username } = profile

  return (
    <div className={className}>
      {showAt && '@'}
      {username}
    </div>
  )
}
