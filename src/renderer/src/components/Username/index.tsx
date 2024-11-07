import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { useFetchProfile } from '@renderer/hooks'
import { toProfile } from '@renderer/lib/link'
import { cn } from '@renderer/lib/utils'
import { SecondaryPageLink } from '@renderer/PageManager'
import ProfileCard from '../ProfileCard'

export default function Username({
  userId,
  showAt = false,
  className
}: {
  userId: string
  showAt?: boolean
  className?: string
}) {
  const { username, pubkey } = useFetchProfile(userId)
  if (!pubkey) return null

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className={cn('inline-block', className)}>
          <SecondaryPageLink
            to={toProfile(pubkey)}
            className={cn('truncate hover:underline')}
            onClick={(e) => e.stopPropagation()}
          >
            {showAt && '@'}
            {username}
          </SecondaryPageLink>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <ProfileCard pubkey={pubkey} />
      </HoverCardContent>
    </HoverCard>
  )
}
