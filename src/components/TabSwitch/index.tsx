import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { useTranslation } from 'react-i18next'

type TabDefinition = {
  value: string
  label: string
  onClick?: () => void
}

export default function TabSwitcher({
  tabs,
  value,
  className,
  onTabChange
}: {
  tabs: TabDefinition[]
  value: string
  className?: string
  onTabChange?: (tab: string) => void
}) {
  const { t } = useTranslation()
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()
  const activeIndex = tabs.findIndex((tab) => tab.value === value)

  return (
    <div
      className={cn(
        'sticky top-12 bg-background z-30 w-full transition-transform',
        deepBrowsing && lastScrollTop > 800 ? '-translate-y-[calc(100%+12rem)]' : '',
        className
      )}
    >
      <div className="flex">
        {tabs.map((tab) => (
          <div
            key={tab.value}
            className={cn(
              `flex-1 text-center py-2 font-semibold clickable cursor-pointer rounded-lg`,
              value === tab.value ? '' : 'text-muted-foreground'
            )}
            onClick={() => {
              tab.onClick?.()
              onTabChange?.(tab.value)
            }}
          >
            {t(tab.label)}
          </div>
        ))}
      </div>
      <div className="relative">
        <div
          className="absolute bottom-0 px-4 transition-all duration-500"
          style={{
            width: `${100 / tabs.length}%`,
            left: `${activeIndex >= 0 ? activeIndex * (100 / tabs.length) : 0}%`
          }}
        >
          <div className="w-full h-1 bg-primary rounded-full" />
        </div>
      </div>
    </div>
  )
}
