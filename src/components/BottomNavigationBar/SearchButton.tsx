import { usePrimaryPage } from '@/PageManager'
import { MagnifyingGlass } from '@phosphor-icons/react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function SearchButton() {
  const { navigate, current, display } = usePrimaryPage()
  const active = current === 'search' && display

  return (
    <BottomNavigationBarItem active={active} onClick={() => navigate('search')}>
      <MagnifyingGlass weight={active ? 'fill' : 'bold'} />
    </BottomNavigationBarItem>
  )
}
