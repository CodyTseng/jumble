import { usePrimaryPage } from '@/PageManager'
import { Bell } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function NotificationsButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <BottomNavigationBarItem
      active={current === 'notifications'}
      onClick={() => navigate('notifications')}
    >
      <Bell />
    </BottomNavigationBarItem>
  )
}
