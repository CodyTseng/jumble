import Hat from '@/assets/christmas/hat.png'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { useChristmas } from '@/providers/ChristmasProvider'
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
  const { enabled } = useChristmas()
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
          {enabled && !['tiny', 'large'].includes(size) && (
            <img
              src={Hat}
              alt="Hat"
              className={cn('absolute', HatSizeCnMap[size as 'normal' | 'small'])}
            />
          )}
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
  size?: 'large' | 'normal' | 'small' | 'tiny'
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
