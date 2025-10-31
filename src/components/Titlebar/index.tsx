import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'

export function Titlebar({
  children,
  className,
  hideBottomBorder = false
}: {
  children?: React.ReactNode
  className?: string
  hideBottomBorder?: boolean
}) {
  const { isSmallScreen } = useScreenSize()

  return (
    <div
      className={cn(
        'sticky top-0 w-full h-12 z-40 bg-card/80 backdrop-blur-xl [&_svg]:size-5 [&_svg]:shrink-0 select-none',
        !hideBottomBorder && !isSmallScreen && 'border-b',
        className
      )}
    >
      {children}
    </div>
  )
}
