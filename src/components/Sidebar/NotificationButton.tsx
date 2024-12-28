import { toNotifications } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Bell } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function NotificationButton() {
  const { push } = useSecondaryPage()

  return (
    <SidebarItem
      title="notifications"
      description="Notifications"
      onClick={() => push(toNotifications())}
    >
      <Bell />
    </SidebarItem>
  )
}
