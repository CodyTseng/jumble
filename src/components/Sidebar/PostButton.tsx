import PostEditor from '@/components/PostEditor'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { PencilSimpleLine } from '@phosphor-icons/react'
import { useState } from 'react'
import SidebarItem from './SidebarItem'

export default function PostButton({ collapse }: { collapse: boolean }) {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <div className="pt-4">
      <SidebarItem
        title="New post"
        description="Post"
        onClick={(e) => {
          e.stopPropagation()
          checkLogin(() => {
            setOpen(true)
          })
        }}
        variant="default"
        className={cn('gap-2 bg-primary', !collapse && 'justify-center')}
        collapse={collapse}
      >
        <PencilSimpleLine weight="bold" />
      </SidebarItem>
      <PostEditor open={open} setOpen={setOpen} />
    </div>
  )
}
