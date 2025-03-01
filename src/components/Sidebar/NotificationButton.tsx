import { usePrimaryPage } from '@/PageManager'
import { useNotification } from '@/providers/NotificationProvider'
import { Bell } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function NotificationsButton() {
  const { navigate, current } = usePrimaryPage()
  const { hasNewNotification } = useNotification()

  return (
    <SidebarItem
      title="Notifications"
      onClick={() => navigate('notifications')}
      active={current === 'notifications'}
    >
      <div className="relative">
        <Bell strokeWidth={3} />
        {hasNewNotification && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </div>
    </SidebarItem>
  )
}
