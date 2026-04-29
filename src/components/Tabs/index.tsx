import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { SlidersHorizontal } from 'lucide-react'
import {
  Children,
  Fragment,
  isValidElement,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

type TabDefinition = {
  value: string
  label: string
  dot?: boolean
  count?: number
}

export default function Tabs({
  tabs,
  value,
  onTabChange,
  onCustomize,
  options = null,
  active = false
}: {
  tabs: TabDefinition[]
  value: string
  onTabChange?: (tab: string) => void
  onCustomize?: () => void
  options?: ReactNode
  active?: boolean
}) {
  const { t, i18n } = useTranslation()
  const { deepBrowsing } = useDeepBrowsing()
  const dir = i18n.dir()
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 })
  const [isSticky, setIsSticky] = useState(false)

  const hasOptions = useMemo(() => {
    const children = Children.toArray(options)
    if (
      children.length === 1 &&
      isValidElement(children[0]) &&
      children[0].type === Fragment
    ) {
      const inner = (children[0].props as { children?: ReactNode }).children
      return Children.toArray(inner).length > 0
    }
    return children.length > 0
  }, [options])

  const updateIndicatorPosition = () => {
    const activeIndex = tabs.findIndex((tab) => tab.value === value)
    if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
      const activeTab = tabRefs.current[activeIndex]
      const { offsetWidth, offsetLeft } = activeTab
      const padding = 24 // 12px padding on each side
      setIndicatorStyle({
        width: offsetWidth - padding,
        left: offsetLeft + padding / 2
      })
    }
  }

  useEffect(() => {
    const animationId = requestAnimationFrame(() => {
      updateIndicatorPosition()
    })

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [tabs, value, dir])

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      updateIndicatorPosition()
    })

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            requestAnimationFrame(() => {
              updateIndicatorPosition()
            })
          }
        })
      },
      { threshold: 0 }
    )

    intersectionObserver.observe(containerRef.current)

    tabRefs.current.forEach((tab) => {
      if (tab) resizeObserver.observe(tab)
    })

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [tabs, value])

  useEffect(() => {
    if (!sentinelRef.current) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsSticky(false)
      } else {
        // Distinguish "sentinel scrolled above" (tabs are CSS-sticky) from
        // "sentinel still below viewport" (tabs not reached yet).
        // When sticky, the container stays fixed while the sentinel scrolls away,
        // creating a gap. When not sticky, they remain adjacent (gap ≈ 0).
        const containerRect = containerRef.current?.getBoundingClientRect()
        if (containerRect) {
          setIsSticky(containerRect.top - entry.boundingClientRect.bottom > 10)
        }
      }
    })

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      <div
        ref={containerRef}
        className={cn(
          'sticky top-12 z-30 flex w-full justify-between border-b bg-background px-1 transition-all duration-300',
          deepBrowsing && isSticky && !active
            ? '-translate-y-[calc(100%+12rem)]'
            : ''
        )}
      >
      <ScrollArea className="w-0 flex-1" dir={dir}>
        <div className="relative flex w-fit">
          {tabs.map((tab, index) => (
            <div
              key={tab.value}
              ref={(el) => (tabRefs.current[index] = el)}
              className={cn(
                `clickable relative my-1 w-fit cursor-pointer whitespace-nowrap rounded-xl px-3 py-2 text-center font-semibold transition-all duration-200`,
                value === tab.value
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                onTabChange?.(tab.value)
              }}
            >
              {t(tab.label)}
              {tab.count != null && tab.count > 0 && (
                <span className="ms-1 align-middle text-xs font-semibold tabular-nums text-muted-foreground">
                  {tab.count >= 100 ? '99+' : tab.count}
                </span>
              )}
              {tab.dot && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
          ))}
          {onCustomize && (
            <div
              className="clickable my-1 flex w-fit cursor-pointer items-center whitespace-nowrap rounded-xl px-3 py-2 text-muted-foreground transition-all duration-200 hover:text-foreground"
              onClick={onCustomize}
              title={t('Customize tabs')}
              aria-label={t('Customize tabs')}
            >
              <SlidersHorizontal size={16} />
            </div>
          )}
          <div
            className="absolute bottom-0 h-1 rounded-full bg-linear-to-r from-primary to-primary-hover transition-all duration-300"
            style={{
              width: `${indicatorStyle.width}px`,
              left: `${indicatorStyle.left}px`
            }}
          />
        </div>
        <ScrollBar orientation="horizontal" className="pointer-events-none opacity-0" />
      </ScrollArea>
      {hasOptions && (
        <div className="flex items-center gap-1 py-1">
          <Separator orientation="vertical" className="h-8" />
          {options}
        </div>
      )}
    </div>
    </>
  )
}
