import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { SimpleUserAvatar } from '../UserAvatar'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function AccountButton() {
  const { navigate, current, display } = usePrimaryPage()
  const { pubkey } = useNostr()
  const active = display && current === 'me'

  return (
    <BottomNavigationBarItem
      onClick={() => {
        navigate('me')
      }}
      active={active}
    >
      {pubkey ? (
        <SimpleUserAvatar
          userId={pubkey}
          size="small"
          className={active ? 'ring-primary ring-1' : ''}
        />
      ) : (
        <UserRound />
      )}
    </BottomNavigationBarItem>
  )
}
