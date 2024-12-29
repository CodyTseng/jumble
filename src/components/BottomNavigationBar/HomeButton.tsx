import { usePrimaryPage } from '@/PageManager'
import { Home } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function HomeButton() {
  const { navigate, current, display } = usePrimaryPage()
  const active = display && current === 'home'

  return (
    <BottomNavigationBarItem active={active} onClick={() => navigate('home')}>
      <Home />
    </BottomNavigationBarItem>
  )
}
