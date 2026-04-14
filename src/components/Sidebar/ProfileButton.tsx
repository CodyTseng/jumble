import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { User } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function ProfileButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const { checkLogin } = useNostr()
  const active = display && current === 'profile'

  return (
    <SidebarItem
      title="Profile"
      onClick={() => checkLogin(() => navigate('profile'))}
      active={active}
      collapse={collapse}
    >
      <User weight={active ? 'fill' : 'bold'} />
    </SidebarItem>
  )
}
