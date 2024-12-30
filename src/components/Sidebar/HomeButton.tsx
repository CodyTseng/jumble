import { usePrimaryPage } from '@/PageManager'
import { Home } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function HomeButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem title="Home" onClick={() => navigate('home')} active={current === 'home'}>
      <Home strokeWidth={3} />
    </SidebarItem>
  )
}
