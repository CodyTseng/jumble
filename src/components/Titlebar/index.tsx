import { cn } from '@/lib/utils'

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
        'sticky top-0 w-full z-50 bg-background [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
    >
      {children}
    </div>
  )
}
