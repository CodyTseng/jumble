import { usePrimaryPage } from '@/PageManager'
import { Bell } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function NotificationsButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem
      title="Notifications"
      onClick={() => navigate('notifications')}
      active={current === 'notifications'}
    >
      <Bell strokeWidth={3} />
    </SidebarItem>
  )
}
