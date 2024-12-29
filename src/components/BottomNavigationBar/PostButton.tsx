import PostDialog from '@/components/PostDialog'
import { PencilLine } from 'lucide-react'
import { useState } from 'react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function PostButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <BottomNavigationBarItem
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <PencilLine />
      </BottomNavigationBarItem>
      <PostDialog open={open} setOpen={setOpen} />
    </>
  )
}
