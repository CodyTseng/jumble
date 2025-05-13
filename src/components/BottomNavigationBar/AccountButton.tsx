import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { generateImageByPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { useMemo } from 'react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function AccountButton() {
  const { navigate, current } = usePrimaryPage()
  const { pubkey, profile } = useNostr()
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  return (
    <BottomNavigationBarItem
      onClick={() => {
        navigate('me')
      }}
      active={current === 'me'}
    >
      {pubkey ? (
        profile ? (
          <Avatar className={cn('w-7 h-7', current === 'me' ? 'ring-primary ring-1' : '')}>
            <AvatarImage src={profile.avatar} className="object-cover object-center" />
            <AvatarFallback>
              <img src={defaultAvatar} />
            </AvatarFallback>
          </Avatar>
        ) : (
          <Skeleton
            className={cn('w-7 h-7 rounded-full', current === 'me' ? 'ring-primary ring-1' : '')}
          />
        )
      ) : (
        <UserRound />
      )}
    </BottomNavigationBarItem>
  )
}
