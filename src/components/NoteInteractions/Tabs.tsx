import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { useRef, useEffect, useState } from 'react'

export type TTabValue = 'replies' | 'quotes' | 'reactions' | 'reposts' | 'zaps'
const TABS = [
  { value: 'replies', label: 'Replies' },
  { value: 'zaps', label: 'Zaps' },
  { value: 'reposts', label: 'Reposts' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'quotes', label: 'Quotes' }
] as { value: TTabValue; label: string }[]

export function Tabs({
  selectedTab,
  onTabChange
}: {
  selectedTab: TTabValue
  onTabChange: (tab: TTabValue) => void
}) {
  const { t } = useTranslation()
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 })

  useEffect(() => {
    setTimeout(() => {
      const activeIndex = TABS.findIndex((tab) => tab.value === selectedTab)
      if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
        const activeTab = tabRefs.current[activeIndex]
        const { offsetWidth, offsetLeft } = activeTab
        const padding = 32 // 16px padding on each side
        setIndicatorStyle({
          width: offsetWidth - padding,
          left: offsetLeft + padding / 2
        })
      }
    }, 20) // ensure tabs are rendered before calculating
  }, [selectedTab])

  return (
    <div className="w-fit">
      <div className="flex relative">
        {TABS.map((tab, index) => (
          <div
            key={tab.value}
            ref={(el) => (tabRefs.current[index] = el)}
            className={cn(
              `text-center px-4 py-2 font-semibold clickable cursor-pointer rounded-lg`,
              selectedTab === tab.value ? '' : 'text-muted-foreground'
            )}
            onClick={() => onTabChange(tab.value)}
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
    </div>
  )
}
