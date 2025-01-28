import PostEditor from '@/components/PostEditor'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'

export default function PostButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        className={cn(
          'flex shadow-none items-center w-fit m-1 rounded-xl font-semibold [&_svg]:size-6'
        )}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Plus />
      </Button>
      <PostEditor open={open} setOpen={setOpen} />
    </>
  )
}
