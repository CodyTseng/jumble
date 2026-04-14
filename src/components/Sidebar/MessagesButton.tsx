import { useDmUnread } from '@/hooks/useDmUnread'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { ChatCircle } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function MessagesButton({ collapse }: { collapse: boolean }) {
  const { checkLogin } = useNostr()
  const { navigate, current, display } = usePrimaryPage()
  const { hasUnread } = useDmUnread()
  const active = display && current === 'dms'

  return (
    <SidebarItem
      title="Messages"
      onClick={() => checkLogin(() => navigate('dms'))}
      active={active}
      collapse={collapse}
    >
      <div className="relative">
        <ChatCircle weight={active ? 'fill' : 'bold'} />
        {hasUnread && (
          <div className="absolute -top-1 right-0 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>
    </SidebarItem>
  )
}
