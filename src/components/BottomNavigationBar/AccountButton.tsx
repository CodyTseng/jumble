import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { SimpleUserAvatar } from '../UserAvatar'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function AccountButton() {
  const { pubkey, checkLogin } = useNostr()

  return (
    <BottomNavigationBarItem
      onClick={() => {
        if (pubkey) {
          // TODO: Open profile
        } else {
          checkLogin()
        }
      }}
    >
      {pubkey ? <SimpleUserAvatar userId={pubkey} size="small" /> : <UserRound />}
    </BottomNavigationBarItem>
  )
}
