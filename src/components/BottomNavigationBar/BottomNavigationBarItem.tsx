import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MouseEventHandler } from 'react'

export default function BottomNavigationBarItem({
  children,
  active = false,
  onClick,
  onPointerDown,
  onPointerUp
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: MouseEventHandler
  onPointerDown?: MouseEventHandler
  onPointerUp?: MouseEventHandler
}) {
  return (
    <Button
      className={cn(
        'm-0 flex h-12 w-full items-center rounded-lg bg-transparent p-3 shadow-none [&_svg]:size-6',
        active ? 'text-foreground' : 'text-muted-foreground'
      )}
      variant="ghost"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {children}
    </Button>
  )
}
