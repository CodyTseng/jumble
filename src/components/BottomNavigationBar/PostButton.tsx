import PostEditor from '@/components/PostEditor'
import { useNostr } from '@/providers/NostrProvider'
import { Plus } from 'lucide-react'
import { useState } from 'react'

export default function PostButton() {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex w-full items-center justify-center px-4">
      <button
        className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95"
        onClick={() => {
          checkLogin(() => {
            setOpen(true)
          })
        }}
      >
        <Plus className="!size-6 stroke-[2.5]" />
      </button>
      <PostEditor open={open} setOpen={setOpen} />
    </div>
  )
}
