import { useOpenNewPost } from '@/components/NewPost'
import { useNostr } from '@/providers/NostrProvider'
import { PlusCircleIcon } from '@phosphor-icons/react'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function PostButton() {
  const { checkLogin } = useNostr()
  const openNewPost = useOpenNewPost()

  return (
    <BottomNavigationBarItem onClick={() => checkLogin(openNewPost)}>
      <PlusCircleIcon weight="regular" className="size-7!" />
    </BottomNavigationBarItem>
  )
}
