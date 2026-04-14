import { cn } from '@/lib/utils'

export function Titlebar({
  children,
  className,
  hideBottomBorder = false
}: {
  children?: React.ReactNode
  className?: string
  hideBottomBorder?: boolean
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-40 h-12 w-full select-none bg-background [&_svg]:size-5 [&_svg]:shrink-0',
        !hideBottomBorder && 'border-b',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ThreeSectionTitlebar({
  left,
  center,
  right,
  sideWidth = '3rem',
  className,
  hideBottomBorder
}: {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
  sideWidth?: string
  className?: string
  hideBottomBorder?: boolean
}) {
  const sideStyle = { flex: `0 0 ${sideWidth}` }

  return (
    <Titlebar className={cn('p-1', className)} hideBottomBorder={hideBottomBorder}>
      <div className="flex h-full items-center">
        <div className="flex items-center justify-start" style={sideStyle}>
          {left}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center px-1">
          {typeof center === 'string' ? (
            <div className="truncate text-lg font-semibold">{center}</div>
          ) : (
            center
          )}
        </div>
        <div className="flex items-center justify-end" style={sideStyle}>
          {right}
        </div>
      </div>
    </Titlebar>
  )
}
