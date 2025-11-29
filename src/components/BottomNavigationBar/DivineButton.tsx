import { usePrimaryPage } from '@/PageManager'
import { Clapperboard } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function DivineButton() {
  const { current, navigate } = usePrimaryPage()

  return (
    <BottomNavigationBarItem
      active={current === 'divine'}
      onClick={() => navigate('divine')}
    >
      <Clapperboard />
    </BottomNavigationBarItem>
  )
}
