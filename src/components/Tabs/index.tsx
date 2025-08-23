import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TabDefinition = {
  value: string
  label: string
}

export default function Tabs({
  tabs,
  value,
  onTabChange,
  threshold = 800,
  options
}: {
  tabs: TabDefinition[]
  value: string
  onTabChange?: (tab: string) => void
  threshold?: number
  options?: ReactNode
}) {
  const { t } = useTranslation()
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 })

  useEffect(() => {
    setTimeout(() => {
      const activeIndex = tabs.findIndex((tab) => tab.value === value)
      if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
        const activeTab = tabRefs.current[activeIndex]
        const { offsetWidth, offsetLeft } = activeTab
        const padding = 48 // 24px padding on each side
        setIndicatorStyle({
          width: offsetWidth - padding,
          left: offsetLeft + padding / 2
        })
      }
    }, 20) // ensure tabs are rendered before calculating
  }, [tabs, value])

  return (
    <div
      className={cn(
        'sticky flex justify-between top-12 py-1 bg-background z-30 w-full transition-transform',
        deepBrowsing && lastScrollTop > threshold ? '-translate-y-[calc(100%+12rem)]' : ''
      )}
    >
      <div className="flex w-fit">
        {tabs.map((tab, index) => (
          <div
            key={tab.value}
            ref={(el) => (tabRefs.current[index] = el)}
            className={cn(
              `w-fit text-center py-2 px-6 font-semibold clickable cursor-pointer rounded-lg`,
              value === tab.value ? '' : 'text-muted-foreground'
            )}
            onClick={() => {
              onTabChange?.(tab.value)
            }}
          >
            {t(tab.label)}
          </div>
        ))}
        <div
          className="absolute bottom-0 h-1 bg-primary rounded-full transition-all duration-500"
          style={{
            width: `${indicatorStyle.width}px`,
            left: `${indicatorStyle.left}px`
          }}
        />
      </div>
      {options}
    </div>
  )
}
