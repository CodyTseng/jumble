import PostEditor from '@/components/PostEditor'
import { useNostr } from '@/providers/NostrProvider'
import { PlusCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function PostButton() {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <>
      <BottomNavigationBarItem
        onClick={() => {
          checkLogin(() => {
            setOpen(true)
          })
        }}
      >
        <PlusCircle weight="bold" className="size-7!" />
      </BottomNavigationBarItem>
      <PostEditor open={open} setOpen={setOpen} />
    </>
  )
}
