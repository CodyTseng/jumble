import { usePrimaryPage } from '@/PageManager'
import { Compass } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function ExploreButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <BottomNavigationBarItem active={current === 'explore'} onClick={() => navigate('explore')}>
      <Compass />
    </BottomNavigationBarItem>
  )
}
