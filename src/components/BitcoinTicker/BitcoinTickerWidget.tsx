import WidgetContainer from '@/components/WidgetContainer'
import BitcoinTicker from './index'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { AVAILABLE_WIDGETS, useWidgets } from '@/providers/WidgetsProvider'
import { EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function BitcoinTickerWidget() {
  const { t } = useTranslation()
  const { toggleWidget, hideWidgetTitles } = useWidgets()
  const [isHovered, setIsHovered] = useState(false)

  // Get the widget name from AVAILABLE_WIDGETS
  const widgetName = AVAILABLE_WIDGETS.find(w => w.id === 'bitcoin-ticker')?.name || 'Bitcoin Ticker'

  return (
    <WidgetContainer>
      {!hideWidgetTitles && (
        <CardHeader
          className="flex flex-row items-center justify-between space-y-0 p-4 pb-3 border-b group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <CardTitle className="font-semibold" style={{ fontSize: '14px' }}>{widgetName}</CardTitle>
          {isHovered && (
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => toggleWidget('bitcoin-ticker')}
              title={t('Hide widget')}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          )}
        </CardHeader>
      )}
      <BitcoinTicker />
    </WidgetContainer>
  )
}
