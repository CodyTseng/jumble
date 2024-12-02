import { isMacOS } from '@renderer/lib/env'
import { cn } from '@renderer/lib/utils'
import { useScreenSize } from '@renderer/providers/ScreenSizeProvider'

export function Titlebar({
  children,
  className
}: {
  children?: React.ReactNode
  className?: string
}) {
  const { isSmallScreen } = useScreenSize()

  if (isMacOS() && isSmallScreen) {
    return (
      <div className="absolute top-0 w-full z-50 bg-background/80 backdrop-blur-md font-semibold">
        <div className="draggable h-9 w-full" />
        <div className={cn('h-11 flex gap-1 items-center', className)}>{children}</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'draggable absolute top-0 w-full h-9 z-50 bg-background/80 backdrop-blur-md flex items-center font-semibold gap-1 px-2',
        className
      )}
    >
      {children}
    </div>
  )
}
