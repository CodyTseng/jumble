import { usePrimaryPage } from '@/PageManager'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function SearchButton() {
  const { navigate, current, display } = usePrimaryPage()
  const active = current === 'search' && display

  return (
    <BottomNavigationBarItem active={active} onClick={() => navigate('search')}>
      <MagnifyingGlassIcon weight={active ? 'fill' : 'bold'} />
    </BottomNavigationBarItem>
  )
}
