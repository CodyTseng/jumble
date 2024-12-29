import { usePrimaryPage } from '@/PageManager'
import { Bell } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function NotificationsButton() {
  const { navigate, current } = usePrimaryPage()
  const active = current === 'notifications'

  return (
    <BottomNavigationBarItem active={active} onClick={() => navigate('notifications')}>
      <Bell />
    </BottomNavigationBarItem>
  )
}
