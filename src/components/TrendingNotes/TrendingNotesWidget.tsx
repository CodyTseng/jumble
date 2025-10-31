import WidgetContainer from '@/components/WidgetContainer'
import { useWidgets, AVAILABLE_WIDGETS } from '@/providers/WidgetsProvider'
import CompactTrendingNotes from './CompactTrendingNotes'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const HEIGHT_CLASSES = {
  short: 'max-h-[220px]',
  medium: 'max-h-[320px]',
  tall: 'max-h-[480px]',
  remaining: 'h-full'
}

export default function TrendingNotesWidget() {
  const { t } = useTranslation()
  const { trendingNotesHeight, enabledWidgets, toggleWidget } = useWidgets()
  const [isHovered, setIsHovered] = useState(false)

  // Check if trending notes is the only enabled widget
  // (other widgets could be pinned notes or bitcoin ticker)
  const otherWidgets = enabledWidgets.filter(id => id !== 'trending-notes')
  const isOnlyWidget = otherWidgets.length === 0

  // Use configured height, with special handling for 'remaining' to force full height
  const heightClass = isOnlyWidget ? 'h-full' : HEIGHT_CLASSES[trendingNotesHeight]

  // Get the widget name from AVAILABLE_WIDGETS
  const widgetName = AVAILABLE_WIDGETS.find(w => w.id === 'trending-notes')?.name || 'Trending Notes'

  // Use full height for container if 'remaining' is selected or it's the only widget
  const useFullHeight = trendingNotesHeight === 'remaining' || isOnlyWidget

  return (
    <WidgetContainer className={useFullHeight ? 'h-full flex flex-col' : 'flex flex-col'}>
      <CardHeader
        className="flex flex-row items-center justify-between space-y-0 p-4 pb-3 border-b group flex-shrink-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardTitle className="font-semibold" style={{ fontSize: '14px' }}>{widgetName}</CardTitle>
        {isHovered && (
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            onClick={() => toggleWidget('trending-notes')}
            title={t('Hide widget')}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </CardHeader>
      <div className={`${heightClass} overflow-y-auto overflow-x-hidden scrollbar-hide px-4 pb-4 ${useFullHeight ? 'flex-1 min-h-0' : ''}`}>
        <CompactTrendingNotes />
      </div>
    </WidgetContainer>
  )
}
