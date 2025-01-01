import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { generateImageByPubkey } from '@/lib/pubkey'
import { toProfile } from '@/lib/link'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import ProfileCard from '../ProfileCard'
import { useMemo } from 'react'

const UserAvatarSizeCnMap = {
  large: 'w-24 h-24',
  big: 'w-16 h-16',
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
  size?: 'large' | 'big' | 'normal' | 'small' | 'tiny'
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

export function SimpleUserAvatar({
  userId,
  size = 'normal',
  className,
  onClick
}: {
  userId: string
  size?: 'large' | 'big' | 'normal' | 'small' | 'tiny'
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
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
    <Avatar className={cn(UserAvatarSizeCnMap[size], className)} onClick={onClick}>
      <AvatarImage src={avatar} className="object-cover object-center" />
      <AvatarFallback>
        <img src={defaultAvatar} alt={pubkey} />
      </AvatarFallback>
    </Avatar>
  )
}
