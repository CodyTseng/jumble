import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserIcon } from '@phosphor-icons/react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function ProfileButton() {
  const { navigate, current, display } = usePrimaryPage()
  const { checkLogin } = useNostr()
  const active = current === 'profile' && display

  return (
    <BottomNavigationBarItem
      active={active}
      onClick={() => checkLogin(() => navigate('profile'))}
    >
      <UserIcon weight={active ? 'fill' : 'regular'} />
    </BottomNavigationBarItem>
  )
}
