import PostEditor from '@/components/PostEditor'
import { POST_BUTTON_STYLE } from '@/constants'
import { cn } from '@/lib/utils'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { usePostButtonStyle } from '@/providers/PostButtonStyleProvider'
import { useNostr } from '@/providers/NostrProvider'
import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import SidebarItem from './SidebarItem'

export default function PostButton() {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)
  const { compactSidebar } = useCompactSidebar()
  const { postButtonStyle } = usePostButtonStyle()
  const isOutlined = postButtonStyle === POST_BUTTON_STYLE.OUTLINED

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
        className={cn(
          "gap-2",
          isOutlined
            ? "border-2 border-primary text-primary-foreground bg-transparent hover:bg-primary/10"
            : "bg-primary",
          compactSidebar ? "" : "xl:justify-center"
        )}
      >
        <PencilLine strokeWidth={1.3} />
      </SidebarItem>
      <PostEditor open={open} setOpen={setOpen} />
    </div>
  )
}
