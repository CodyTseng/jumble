import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { BellIcon } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function NotificationsButton({ collapse }: { collapse: boolean }) {
  const { checkLogin } = useNostr()
  const { navigate, current, display } = usePrimaryPage()
  const { hasNewNotification } = useNotification()
  const active = display && current === 'notifications'

  return (
    <SidebarItem
      title="Notifications"
      onClick={() => checkLogin(() => navigate('notifications'))}
      active={active}
      collapse={collapse}
    >
      <div className="relative">
        <BellIcon weight={active ? 'fill' : 'bold'} />
        {hasNewNotification && (
          <div className="bg-primary ring-background absolute -top-1 right-0 h-2 w-2 rounded-full ring-2" />
        )}
      </div>
    </SidebarItem>
  )
}
