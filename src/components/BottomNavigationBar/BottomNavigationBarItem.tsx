import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { MouseEventHandler } from 'react'

export default function BottomNavigationBarItem({
  children,
  active = false,
  onClick
}: {
  children: React.ReactNode
  active?: boolean
  onClick: MouseEventHandler
}) {
  return (
    <Button
      className={cn(
        'flex shadow-none items-center bg-transparent w-full h-12 p-3 m-0 rounded-lg [&_svg]:size-6',
        active && 'text-primary hover:text-primary'
      )}
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
