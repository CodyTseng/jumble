import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { BellIcon } from '@phosphor-icons/react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function NotificationsButton() {
  const { checkLogin } = useNostr()
  const { navigate, current, display } = usePrimaryPage()
  const { hasNewNotification } = useNotification()
  const active = current === 'notifications' && display

  return (
    <BottomNavigationBarItem
      active={active}
      onClick={() => checkLogin(() => navigate('notifications'))}
    >
      <div className="relative">
        <BellIcon weight={active ? 'fill' : 'bold'} />
        {hasNewNotification && (
          <div className="bg-primary ring-background absolute -top-0.5 right-0.5 h-2 w-2 rounded-full ring-2" />
        )}
      </div>
    </BottomNavigationBarItem>
  )
}
