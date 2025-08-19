import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type TabDefinition = {
  value: string
  label: string
}

export default function Tabs({
  tabs,
  value,
  onTabChange,
  threshold = 800
}: {
  tabs: TabDefinition[]
  value: string
  onTabChange?: (tab: string) => void
  threshold?: number
}) {
  const { t } = useTranslation()
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()
  const activeIndex = useMemo(() => tabs.findIndex((tab) => tab.value === value), [value, tabs])

  return (
    <div
      className={cn(
        'sticky flex top-12 py-1 bg-background z-30 w-full transition-transform',
        deepBrowsing && lastScrollTop > threshold ? '-translate-y-[calc(100%+12rem)]' : ''
      )}
    >
      {tabs.map((tab) => (
        <div
          key={tab.value}
          className={cn(
            `flex-1 text-center py-2 font-semibold clickable cursor-pointer rounded-lg`,
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
        className="absolute bottom-0 left-0 transition-all duration-500"
        style={{
          width: `${100 / tabs.length}%`,
          left: `${activeIndex >= 0 ? activeIndex * (100 / tabs.length) : 0}%`
        }}
      >
        <div className="px-4">
          <div className="w-full h-1 bg-primary rounded-full" />
        </div>
      </div>
    </div>
  )
}
