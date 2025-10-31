import { usePrimaryPage } from '@/PageManager'
import { useDistractionFreeMode } from '@/providers/DistractionFreeModeProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { Bell } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function NotificationsButton() {
  const { checkLogin } = useNostr()
  const { navigate, current } = usePrimaryPage()
  const { hasNewNotification } = useNotification()
  const { isDistractionFree } = useDistractionFreeMode()

  return (
    <SidebarItem
      title="Notifications"
      description={hasNewNotification && !isDistractionFree ? "Notifications, new notifications" : "Notifications"}
      onClick={() => checkLogin(() => navigate('notifications'))}
      active={current === 'notifications'}
    >
      <div className="relative">
        <Bell strokeWidth={1.3} />
        {hasNewNotification && !isDistractionFree && (
          <div className="absolute -top-1 right-0 w-2 h-2 ring-2 ring-background bg-primary rounded-full" aria-label="New notifications" />
        )}
      </div>
    </SidebarItem>
  )
}
