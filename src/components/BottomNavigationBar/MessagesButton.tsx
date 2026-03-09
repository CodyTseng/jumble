import { useDmUnread } from '@/hooks/useDmUnread'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { MessageSquare } from 'lucide-react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function MessagesButton() {
  const { checkLogin } = useNostr()
  const { navigate, current, display } = usePrimaryPage()
  const { hasUnread } = useDmUnread()

  return (
    <BottomNavigationBarItem
      active={current === 'dms' && display}
      onClick={() => checkLogin(() => navigate('dms'))}
    >
      <div className="relative">
        <MessageSquare />
        {hasUnread && (
          <div className="absolute -top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>
    </BottomNavigationBarItem>
  )
}
