import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { toProfile } from '@renderer/lib/url'
import { SecondaryPageLink } from '@renderer/PageManager'
import { useFetchProfile } from '@renderer/hooks'
import ProfileCard from '../ProfileCard'
import { cn } from '@renderer/lib/utils'

const UserAvatarSizeCnMap = {
  large: 'w-24 h-24',
  normal: 'w-10 h-10',
  small: 'w-7 h-7',
  tiny: 'w-3 h-3'
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
  const { avatar, pubkey } = useFetchProfile(userId)
  if (!pubkey) return null

  const defaultAvatar = generateImageByPubkey(pubkey)

  return (
    <HoverCard>
      <HoverCardTrigger>
        <SecondaryPageLink to={toProfile(pubkey)} onClick={(e) => e.stopPropagation()}>
          <Avatar className={cn(UserAvatarSizeCnMap[size], className)}>
            <AvatarImage src={avatar} />
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
