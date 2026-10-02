import PostEditor from '@/components/PostEditor'

export default function NewPost({
  open,
  setOpen
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  return <PostEditor open={open} setOpen={setOpen} />
}
