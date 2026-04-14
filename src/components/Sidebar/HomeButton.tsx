import { usePrimaryPage } from '@/PageManager'
import { House } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function HomeButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const active = display && current === 'home'

  return (
    <SidebarItem
      title="Home"
      onClick={() => navigate('home')}
      active={active}
      collapse={collapse}
    >
      <House weight={active ? 'fill' : 'bold'} />
    </SidebarItem>
  )
}
