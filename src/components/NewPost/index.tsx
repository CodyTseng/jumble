import PostEditor from '@/components/PostEditor'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useCallback } from 'react'

const newPostOpenAtom = atom(false)

export function useOpenNewPost() {
  const setOpen = useSetAtom(newPostOpenAtom)
  return useCallback(() => setOpen(true), [setOpen])
}

/** Mounted once outside navigation so layout changes cannot discard an open composer. */
export default function NewPost() {
  const [open, setOpen] = useAtom(newPostOpenAtom)
  return <PostEditor open={open} setOpen={setOpen} />
}
