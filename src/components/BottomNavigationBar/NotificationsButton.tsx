import { usePrimaryPage } from '@/PageManager'
import { useNotification } from '@/providers/NotificationProvider'
import { Bell } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function NotificationsButton() {
  const { navigate, current } = usePrimaryPage()
  const { hasNewNotification } = useNotification()

  return (
    <BottomNavigationBarItem
      active={current === 'notifications'}
      onClick={() => navigate('notifications')}
    >
      <div className="relative">
        <Bell />
        {hasNewNotification && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </div>
    </BottomNavigationBarItem>
  )
}
