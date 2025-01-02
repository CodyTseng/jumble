import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { SimpleUserAvatar } from '../UserAvatar'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function AccountButton() {
  const { navigate, current } = usePrimaryPage()
  const { pubkey } = useNostr()

  return (
    <BottomNavigationBarItem
      onClick={() => {
        navigate('me')
      }}
      active={current === 'me'}
    >
      {pubkey ? (
        <SimpleUserAvatar
          userId={pubkey}
          size="small"
          className={current === 'me' ? 'ring-primary ring-1' : ''}
        />
      ) : (
        <UserRound />
      )}
    </BottomNavigationBarItem>
  )
}
