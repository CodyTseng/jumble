import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { useMemo } from 'react'
import Image from '../Image'
import ProfileCard from '../ProfileCard'

const UserAvatarSizeCnMap = {
  large: 'w-24 h-24',
  big: 'w-16 h-16',
  semiBig: 'w-12 h-12',
  normal: 'w-10 h-10',
  medium: 'w-9 h-9',
  small: 'w-7 h-7',
  xSmall: 'w-5 h-5',
  tiny: 'w-4 h-4'
}

export default function UserAvatar({
  userId,
  className,
  size = 'normal'
}: {
  userId: string
  className?: string
  size?: 'large' | 'big' | 'semiBig' | 'normal' | 'medium' | 'small' | 'xSmall' | 'tiny'
}) {
  return (
    <HoverCard>
      <HoverCardTrigger>
        <SecondaryPageLink to={toProfile(userId)} onClick={(e) => e.stopPropagation()}>
          <SimpleUserAvatar userId={userId} size={size} className={className} />
        </SecondaryPageLink>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <ProfileCard userId={userId} />
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
  size?: 'large' | 'big' | 'semiBig' | 'normal' | 'medium' | 'small' | 'xSmall' | 'tiny'
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
}) {
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  if (!profile) {
    return (
      <Skeleton className={cn('shrink-0', UserAvatarSizeCnMap[size], 'rounded-full', className)} />
    )
  }
  const { avatar, pubkey } = profile || {}

  return (
    <Image
      image={{ url: avatar ?? defaultAvatar, pubkey }}
      errorPlaceholder={defaultAvatar}
      className="object-cover object-center"
      classNames={{
        wrapper: cn('shrink-0 rounded-full bg-background', UserAvatarSizeCnMap[size], className)
      }}
      onClick={onClick}
    />
  )
}
