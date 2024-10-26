import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { toProfile } from '@renderer/lib/url'
import { SecondaryPageLink } from '@renderer/PageManager'
import { useFetchProfile } from '@renderer/hooks'
import ProfileCard from '../ProfileCard'

export default function UserAvatar({ userId, className }: { userId: string; className?: string }) {
  const { avatar, pubkey } = useFetchProfile(userId)
  if (!pubkey) return null

  const defaultAvatar = generateImageByPubkey(pubkey)

  return (
    <HoverCard>
      <HoverCardTrigger>
        <SecondaryPageLink to={toProfile(pubkey)} onClick={(e) => e.stopPropagation()}>
          <Avatar className={className}>
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