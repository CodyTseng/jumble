import { cn } from '@/lib/utils'

export function Titlebar({
  children,
  className,
  visible = true
}: {
  children?: React.ReactNode
  className?: string
  visible?: boolean
}) {
  return (
    <div
      className={cn(
        'sticky top-0 w-full z-20 bg-background/80 backdrop-blur-md duration-700 transition-transform',
        visible ? '' : '-translate-y-full',
        className
      )}
    >
      {children}
    </div>
  )
}
