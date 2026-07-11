import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function Collapsible({
  alwaysExpand = false,
  children,
  className,
  threshold = 1000,
  collapsedHeight = 600,
  showLessButton = false,
  ...props
}: {
  alwaysExpand?: boolean
  threshold?: number
  collapsedHeight?: number
  /** Show a button to re-collapse after expanding. */
  showLessButton?: boolean
} & React.HTMLProps<HTMLDivElement>) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [shouldCollapse, setShouldCollapse] = useState(false)

  useEffect(() => {
    if (alwaysExpand || shouldCollapse) return

    const contentEl = containerRef.current
    if (!contentEl) return

    const checkHeight = () => {
      const fullHeight = contentEl.scrollHeight
      if (fullHeight > threshold) {
        setShouldCollapse(true)
      }
    }

    checkHeight()

    const observer = new ResizeObserver(() => {
      checkHeight()
    })

    observer.observe(contentEl)

    return () => {
      observer.disconnect()
    }
  }, [alwaysExpand, shouldCollapse])

  return (
    <div
      className={cn('relative overflow-hidden text-start', className)}
      ref={containerRef}
      {...props}
      style={{
        maxHeight: !shouldCollapse || expanded ? 'none' : `${collapsedHeight}px`
      }}
    >
      {children}
      {shouldCollapse && !expanded && (
        <div className="absolute bottom-0 z-10 flex h-40 w-full items-end justify-center bg-linear-to-b from-transparent to-background/90 pb-4">
          <div className="rounded-lg bg-background">
            <Button
              className="bg-foreground hover:bg-foreground/80"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(true)
              }}
            >
              {t('Show more')}
            </Button>
          </div>
        </div>
      )}
      {shouldCollapse && expanded && showLessButton && (
        <div className="mt-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
          >
            {t('Show less')}
          </Button>
        </div>
      )}
    </div>
  )
}
