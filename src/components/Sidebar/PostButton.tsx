import { useOpenNewPost } from '@/components/NewPost'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { PencilLine } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function PostButton({ collapse }: { collapse: boolean }) {
  const { checkLogin } = useNostr()
  const openNewPost = useOpenNewPost()

  return (
    <div className="pt-4">
      <SidebarItem
        title="New post"
        description="Post"
        onClick={(e) => {
          e.stopPropagation()
          checkLogin(openNewPost)
        }}
        variant="default"
        className={cn('bg-primary gap-2', !collapse && 'justify-center')}
        collapse={collapse}
      >
        <PencilLine />
      </SidebarItem>
    </div>
  )
}
