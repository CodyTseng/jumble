import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Bookmark } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function BookmarkButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const { checkLogin } = useNostr()

  return (
    <SidebarItem
      title="Bookmarks"
      onClick={() => checkLogin(() => navigate('bookmark'))}
      active={display && current === 'bookmark'}
      collapse={collapse}
    >
      <Bookmark />
    </SidebarItem>
  )
}
