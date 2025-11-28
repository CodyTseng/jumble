import { usePrimaryPage } from '@/PageManager'
import { Clapperboard } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function DivineButton({ collapse }: { collapse: boolean }) {
  const { current, display, navigate } = usePrimaryPage()

  return (
    <SidebarItem
      title="Divine"
      onClick={() => navigate('divine')}
      active={display && current === 'divine'}
      collapse={collapse}
    >
      <Clapperboard />
    </SidebarItem>
  )
}
