import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { BookmarkSimple } from '@phosphor-icons/react'
import SidebarItem from './SidebarItem'

export default function BookmarkButton({ collapse }: { collapse: boolean }) {
  const { navigate, current, display } = usePrimaryPage()
  const { checkLogin } = useNostr()
  const active = display && current === 'bookmark'

  return (
    <SidebarItem
      title="Bookmarks"
      onClick={() => checkLogin(() => navigate('bookmark'))}
      active={active}
      collapse={collapse}
    >
      <BookmarkSimple weight={active ? 'fill' : 'bold'} />
    </SidebarItem>
  )
}
