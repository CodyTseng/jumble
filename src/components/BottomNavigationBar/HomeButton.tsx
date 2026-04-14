import { usePrimaryPage } from '@/PageManager'
import { House } from '@phosphor-icons/react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function HomeButton() {
  const { navigate, current, display } = usePrimaryPage()
  const active = current === 'home' && display

  return (
    <BottomNavigationBarItem active={active} onClick={() => navigate('home')}>
      <House weight={active ? 'fill' : 'bold'} />
    </BottomNavigationBarItem>
  )
}
