import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function ProfileButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const { checkLogin } = useNostr()

  return (
    <SidebarItem
      title="Profile"
      onClick={() => checkLogin(() => navigate('profile'))}
      active={display && current === 'profile'}
      collapse={collapse}
    >
      <UserRound />
    </SidebarItem>
  )
}
