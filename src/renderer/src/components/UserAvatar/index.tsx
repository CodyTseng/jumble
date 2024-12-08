import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useFetchProfile } from '@renderer/hooks'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { toProfile } from '@renderer/lib/link'
import { cn } from '@renderer/lib/utils'
import { SecondaryPageLink } from '@renderer/PageManager'
import ProfileCard from '../ProfileCard'
import { useMemo } from 'react'

const UserAvatarSizeCnMap = {
  large: 'w-24 h-24',
  normal: 'w-10 h-10',
  small: 'w-7 h-7',
  tiny: 'w-4 h-4'
}

export default function UserAvatar({
  userId,
  className,
  size = 'normal'
}: {
  userId: string
  className?: string
  size?: 'large' | 'normal' | 'small' | 'tiny'
}) {
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  if (!profile) {
    return <Skeleton className={cn(UserAvatarSizeCnMap[size], 'rounded-full', className)} />
  }
  const { avatar, pubkey } = profile

  return (
    <HoverCard>
      <HoverCardTrigger>
        <SecondaryPageLink to={toProfile(pubkey)} onClick={(e) => e.stopPropagation()}>
          <Avatar className={cn(UserAvatarSizeCnMap[size], className)}>
            <AvatarImage src={avatar} className="object-cover object-center" />
            <AvatarFallback>
              <img src={defaultAvatar} alt={pubkey} />
            </AvatarFallback>
          </Avatar>
        </SecondaryPageLink>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <ProfileCard pubkey={pubkey} />
      </HoverCardContent>
    </HoverCard>
  )
}
