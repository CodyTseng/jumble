import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { MessageSquare } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function MessagesButton() {
  const { checkLogin } = useNostr()
  const { navigate, current, display } = usePrimaryPage()

  return (
    <BottomNavigationBarItem
      active={current === 'dms' && display}
      onClick={() => checkLogin(() => navigate('dms'))}
    >
      <MessageSquare />
    </BottomNavigationBarItem>
  )
}
