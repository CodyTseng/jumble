import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { MessageSquare } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function MessagesButton({ collapse }: { collapse: boolean }) {
  const { checkLogin } = useNostr()
  const { navigate, current, display } = usePrimaryPage()

  return (
    <SidebarItem
      title="Messages"
      onClick={() => checkLogin(() => navigate('dms'))}
      active={display && current === 'dms'}
      collapse={collapse}
    >
      <MessageSquare />
    </SidebarItem>
  )
}
