import PostDialog from '@renderer/components/PostDialog'
import { Button } from '@renderer/components/ui/button'
import { PencilLine } from 'lucide-react'

export default function PostButton({ variant = 'titlebar' }: { variant?: 'titlebar' | 'sidebar' }) {
  return (
    <PostDialog>
      <Button variant={variant} size={variant} title="new post">
        <PencilLine />
        {variant === 'sidebar' && <div>Post</div>}
      </Button>
    </PostDialog>
  )
}
