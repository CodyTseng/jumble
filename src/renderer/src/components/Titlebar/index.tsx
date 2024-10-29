import { Button } from '@renderer/components/ui/button'
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
        'draggable absolute top-0 w-full h-9 z-50 bg-background/80 backdrop-blur-xl flex items-center  font-semibold space-x-1',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TitlebarButton({
  onClick,
  disabled,
  children
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      className="non-draggable h-7 w-7 p-0 rounded-full"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}
