import { usePrimaryPage } from '@/PageManager'
import { Flame } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function TrendingButton() {
  const { navigate, current } = usePrimaryPage()

  return (
    <BottomNavigationBarItem active={current === 'trending'} onClick={() => navigate('trending')}>
      <Flame />
    </BottomNavigationBarItem>
  )
}
