import { usePrimaryPage } from '@/PageManager'
import { MagnifyingGlass } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function SearchButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const active = current === 'search' && display

  return (
    <SidebarItem
      title="Search"
      onClick={() => navigate('search')}
      active={active}
      collapse={collapse}
    >
      <MagnifyingGlass weight={active ? 'fill' : 'bold'} />
    </SidebarItem>
  )
}
