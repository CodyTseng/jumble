import { Skeleton } from '@/components/ui/skeleton'
import { LONG_PRESS_THRESHOLD } from '@/constants'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import LoginDialog from '../LoginDialog'
import { SimpleUserAvatar } from '../UserAvatar'
import BottomNavigationBarItem from './BottomNavigationBarItem'

export default function AccountButton() {
  const { navigate, current, display } = usePrimaryPage()
  const { pubkey, profile } = useNostr()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const active = useMemo(() => current === 'me' && display, [display, current])
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePointerDown = () => {
    pressTimerRef.current = setTimeout(() => {
      setLoginDialogOpen(true)
      pressTimerRef.current = null
    }, LONG_PRESS_THRESHOLD)
  }

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      navigate('me')
      pressTimerRef.current = null
    }
  }

  return (
    <>
      <BottomNavigationBarItem
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        active={active}
      >
        {pubkey ? (
          profile ? (
            <SimpleUserAvatar
              userId={pubkey}
              className={cn('w-7 h-7', active ? 'ring-primary ring-1' : '')}
            />
          ) : (
            <Skeleton className={cn('w-7 h-7 rounded-full', active ? 'ring-primary ring-1' : '')} />
          )
        ) : (
          <UserRound />
        )}
      </BottomNavigationBarItem>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
    </>
  )
}
