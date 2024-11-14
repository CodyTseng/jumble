import PostDialog from '@renderer/components/PostDialog'
import { Button } from '@renderer/components/ui/button'
import { useNostr } from '@renderer/providers/NostrProvider'
import { PencilLine } from 'lucide-react'

export default function PostButton({ variant = 'titlebar' }: { variant?: 'titlebar' | 'sidebar' }) {
  const { pubkey } = useNostr()

  return (
    <PostDialog>
      <Button variant={variant} size={variant} title="new post" disabled={!pubkey}>
        <PencilLine />
        {variant === 'sidebar' && <div>Post</div>}
      </Button>
    </PostDialog>
  )
}
