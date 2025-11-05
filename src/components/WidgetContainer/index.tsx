import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWidgets } from '@/providers/WidgetsProvider'

type WidgetContainerProps = {
  children: ReactNode
  className?: string
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
}

export default function WidgetContainer({
  children,
  className,
  title,
  dismissible = false,
  onDismiss
}: WidgetContainerProps) {
  const { hideWidgetTitles } = useWidgets()

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      {title && !hideWidgetTitles && (
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{title}</h3>
          {dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
