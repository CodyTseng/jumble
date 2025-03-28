import { usePrimaryPage } from '@/PageManager'
import { Flame } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function TrendingButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <SidebarItem
      title="Trending"
      onClick={() => navigate('trending')}
      active={current === 'trending'}
    >
      <Flame strokeWidth={3} />
    </SidebarItem>
  )
}
