import { usePrimaryPage } from '@/PageManager'
import { Compass } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function RelaysButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem title="Explore" onClick={() => navigate('explore')} active={current === 'explore'}>
      <Compass strokeWidth={3} />
    </SidebarItem>
  )
}
