import { usePrimaryPage } from '@/PageManager'
import { Search } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function SearchButton() {
  const { navigate, current, display } = usePrimaryPage()

  return (
    <BottomNavigationBarItem
      active={current === 'search' && display}
      onClick={() => navigate('search')}
    >
      <Search />
    </BottomNavigationBarItem>
  )
}
