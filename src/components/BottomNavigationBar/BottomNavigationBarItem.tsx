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
        'flex shadow-none items-center bg-transparent w-full h-12 xl:w-full xl:h-auto p-3 m-0 xl:py-2 xl:px-4 rounded-lg xl:justify-start text-lg font-semibold [&_svg]:size-full xl:[&_svg]:size-4',
        active && 'text-primary hover:text-primary'
      )}
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
