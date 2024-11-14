import { cn } from '@renderer/lib/utils'

export function Titlebar({
  children,
  className
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'draggable absolute top-0 w-full h-9 z-50 bg-background/80 backdrop-blur-md flex items-center font-semibold space-x-1 px-2',
        className
      )}
    >
      {children}
    </div>
  )
}
