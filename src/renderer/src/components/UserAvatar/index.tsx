import Hat from '@renderer/assets/christmas/hat.png'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useFetchProfile } from '@renderer/hooks'
import { toProfile } from '@renderer/lib/link'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { cn } from '@renderer/lib/utils'
import { SecondaryPageLink } from '@renderer/PageManager'
import { useMemo } from 'react'
import ProfileCard from '../ProfileCard'

const UserAvatarSizeCnMap = {
  large: 'w-24 h-24',
  normal: 'w-10 h-10',
  small: 'w-7 h-7',
  tiny: 'w-4 h-4'
}

const HatSizeCnMap = {
  normal: '-top-4 right-0 w-9 h-7',
  small: '-top-3 right-0 w-7 h-5'
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
        <SecondaryPageLink
          to={toProfile(pubkey)}
          onClick={(e) => e.stopPropagation()}
          className="relative"
        >
          <Avatar className={cn(UserAvatarSizeCnMap[size], className)}>
            <AvatarImage src={avatar} className="object-cover object-center" />
            <AvatarFallback>
              <img src={defaultAvatar} alt={pubkey} />
            </AvatarFallback>
          </Avatar>
          {!['tiny', 'large'].includes(size) && (
            <img src={Hat} alt="Hat" className={cn('absolute', HatSizeCnMap[size])} />
          )}
        </SecondaryPageLink>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <ProfileCard pubkey={pubkey} />
      </HoverCardContent>
    </HoverCard>
  )
}
