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
  withoutSkeleton = false,
  noLink = false,
  asHeading = false,
  headingLevel = 3
}: {
  userId: string
  showAt?: boolean
  className?: string
  skeletonClassName?: string
  withoutSkeleton?: boolean
  noLink?: boolean
  asHeading?: boolean
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const { profile } = useFetchProfile(userId)
  if (!profile && !withoutSkeleton) {
    return (
      <div className="py-1">
        <Skeleton className={cn('w-16', skeletonClassName)} />
      </div>
    )
  }
  if (!profile) return null

  const { username, pubkey } = profile
  const HeadingTag = asHeading ? (`h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') : 'div'

  if (noLink) {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <HeadingTag className={className}>
            <span className="truncate">
              {showAt && '@'}
              {username}
            </span>
          </HeadingTag>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <ProfileCard pubkey={pubkey} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <HeadingTag className={className}>
          <SecondaryPageLink
            to={toProfile(pubkey)}
            className="truncate hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {showAt && '@'}
            {username}
          </SecondaryPageLink>
        </HeadingTag>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <ProfileCard pubkey={pubkey} />
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
  const { profile } = useFetchProfile(userId)
  if (!profile && !withoutSkeleton) {
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
