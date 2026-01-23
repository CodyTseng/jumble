import { usePrimaryPage } from '@/PageManager'
import { UsersRound } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function FollowingButton() {
  const { navigate, current, display } = usePrimaryPage()

  return (
    <BottomNavigationBarItem
      active={current === 'following' && display}
      onClick={() => navigate('following')}
    >
      <UsersRound />
    </BottomNavigationBarItem>
  )
}
