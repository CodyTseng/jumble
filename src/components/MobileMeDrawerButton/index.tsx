import LoginDialog from '@/components/LoginDialog'
import MeDrawer from '@/components/MeDrawer'
import { Skeleton } from '@/components/ui/skeleton'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { LONG_PRESS_THRESHOLD } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { useRef, useState } from 'react'

export default function MobileMeDrawerButton() {
  const { pubkey, profile } = useNostr()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)

  const handlePointerDown = () => {
    longPressedRef.current = false
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true
      setLoginDialogOpen(true)
      pressTimerRef.current = null
    }, LONG_PRESS_THRESHOLD)
  }

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleClick = () => {
    if (!longPressedRef.current && !loginDialogOpen) {
      if (pubkey) {
        setDrawerOpen(true)
      } else {
        setLoginDialogOpen(true)
      }
    }
  }

  return (
    <>
      <button
        className="flex size-10 items-center justify-center rounded-full"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        {pubkey ? (
          profile ? (
            <SimpleUserAvatar userId={pubkey} ignorePolicy className="size-7" />
          ) : (
            <Skeleton className="size-7 rounded-full" />
          )
        ) : (
          <UserRound className="size-5" />
        )}
      </button>
      <MeDrawer open={drawerOpen} setOpen={setDrawerOpen} />
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
    </>
  )
}
