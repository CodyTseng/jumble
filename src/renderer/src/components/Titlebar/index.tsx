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
        'draggable absolute top-0 w-full h-9 z-50 bg-background/80 backdrop-blur-xl flex items-center font-semibold space-x-1 px-1',
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
  children,
  title
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <Button
      className="non-draggable"
      variant="ghost"
      size="xs"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )
}
