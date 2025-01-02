import { usePrimaryPage } from '@/PageManager'
import { Home } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function HomeButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <BottomNavigationBarItem active={current === 'home'} onClick={() => navigate('home')}>
      <Home />
    </BottomNavigationBarItem>
  )
}
