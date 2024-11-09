import PostDialog from '@renderer/components/PostDialog'
import { Button } from '@renderer/components/ui/button'
import { useNostr } from '@renderer/providers/NostrProvider'
import { PencilLine } from 'lucide-react'

export default function PostButton() {
  const { pubkey } = useNostr()
  if (!pubkey) return null

  return (
    <PostDialog>
      <Button variant="titlebar" size="titlebar">
        <PencilLine />
      </Button>
    </PostDialog>
  )
}
