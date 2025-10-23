import { usePrimaryPage } from '@/PageManager'
import { Home } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function HomeButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()

  return (
    <SidebarItem
      title="Home"
      onClick={() => navigate('home')}
      active={display && current === 'home'}
      collapse={collapse}
    >
      <Home />
    </SidebarItem>
  )
}
