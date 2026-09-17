import NewPost from '@/components/NewPost'
import { useNostr } from '@/providers/NostrProvider'
import { PlusCircleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function PostButton() {
  const { checkLogin } = useNostr()
  const [open, setOpen] = useState(false)

  return (
    <>
      <BottomNavigationBarItem onClick={() => checkLogin(() => setOpen(true))}>
        <PlusCircleIcon weight="regular" className="size-7!" />
      </BottomNavigationBarItem>
      <NewPost open={open} setOpen={setOpen} />
    </>
  )
}
