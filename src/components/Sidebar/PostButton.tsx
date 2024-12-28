import PostDialog from '@/components/PostDialog'
import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import SidebarItem from './SidebarItem'

export default function PostButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <SidebarItem
        title="New post"
        description="Post"
        className="bg-primary text-primary-foreground hover:text-primary-foreground hover:bg-primary/90"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <PencilLine />
      </SidebarItem>
      <PostDialog open={open} setOpen={setOpen} />
    </>
  )
}
