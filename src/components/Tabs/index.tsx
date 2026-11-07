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
    if (children.length === 1 && isValidElement(children[0]) && children[0].type === Fragment) {
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
    const animationId = requestAnimationFrame(() => {
      const activeTab = tabRefs.current[tabs.findIndex((tab) => tab.value === value)]
      const viewport = activeTab?.closest('[data-radix-scroll-area-viewport]')
      if (!activeTab || !viewport) return
      const tabBounds = activeTab.getBoundingClientRect()
      const viewportBounds = viewport.getBoundingClientRect()
      // Physical coordinates work for both LTR and RTL scroll directions.
      const delta =
        tabBounds.left < viewportBounds.left
          ? tabBounds.left - viewportBounds.left
          : tabBounds.right > viewportBounds.right
            ? tabBounds.right - viewportBounds.right
            : 0
      if (delta) viewport.scrollBy({ left: delta })
    })
    return () => cancelAnimationFrame(animationId)
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
    const sentinel = sentinelRef.current
    const container = containerRef.current
    if (!sentinel || !container) return
    const stickyTop = parseFloat(getComputedStyle(container).top) || 0

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Compare coordinates from the same observer snapshot. Live toolbar
        // geometry can already have shifted as images and previews load.
        setIsSticky(
          !entry.isIntersecting &&
            entry.rootBounds !== null &&
            entry.boundingClientRect.bottom < entry.rootBounds.top
        )
      },
      {
        root: sentinel.closest('[data-radix-scroll-area-viewport]'),
        // Match top-12 even when the browser's default font size changes.
        rootMargin: `-${stickyTop}px 0px 0px 0px`
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      <div
        ref={containerRef}
        className={cn(
          'bg-background sticky top-12 z-30 flex w-full justify-between border-b px-1 transition-all duration-300',
          deepBrowsing && isSticky && !active ? '-translate-y-[calc(100%+12rem)]' : ''
        )}
      >
        <ScrollArea className="w-0 flex-1" dir={dir}>
          <div className="relative flex w-fit">
            {tabs.map((tab, index) => (
              <div
                key={tab.value}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                className={cn(
                  `clickable relative my-1 w-fit cursor-pointer rounded-xl px-3 py-2 text-center font-semibold whitespace-nowrap transition-all duration-200`,
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
                  <span className="text-muted-foreground ms-1 align-middle text-xs font-semibold tabular-nums">
                    {tab.count >= 100 ? '99+' : tab.count}
                  </span>
                )}
                {tab.dot && (
                  <span className="bg-primary absolute top-2 right-2 h-2 w-2 rounded-full" />
                )}
              </div>
            ))}
            {onCustomize && (
              <div
                className="clickable text-muted-foreground hover:text-foreground my-1 flex w-fit cursor-pointer items-center rounded-xl px-3 py-2 whitespace-nowrap transition-all duration-200"
                onClick={onCustomize}
                title={t('Customize tabs')}
                aria-label={t('Customize tabs')}
              >
                <SlidersHorizontal size={16} />
              </div>
            )}
            <div
              className="from-primary to-primary-hover absolute bottom-0 h-1 rounded-full bg-linear-to-r transition-all duration-300"
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
