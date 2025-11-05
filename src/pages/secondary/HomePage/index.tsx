import Widgets from '@/components/Widgets'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useWidgets } from '@/providers/WidgetsProvider'
import { useDeckView } from '@/providers/DeckViewProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { useWidgetSidebarDismissed } from '@/providers/WidgetSidebarDismissedProvider'
import { useWidgetSidebarTitle } from '@/providers/WidgetSidebarTitleProvider'
import { useSecondaryPage } from '@/PageManager'
import { DECK_VIEW_MODE, LAYOUT_MODE } from '@/constants'
import { forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Settings } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toWidgetsSettings } from '@/lib/link'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  const { enabledWidgets } = useWidgets()
  const { layoutMode } = useLayoutMode()
  const { deckViewMode } = useDeckView()
  const { clear, push } = useSecondaryPage()
  const { setWidgetSidebarDismissed } = useWidgetSidebarDismissed()
  const { widgetSidebarTitle, widgetSidebarIcon } = useWidgetSidebarTitle()
  const { t } = useTranslation()

  // Get the icon component if one is selected
  const IconComponent = widgetSidebarIcon ? (LucideIcons as any)[widgetSidebarIcon] : null

  const handleClose = () => {
    // If we have a secondary page open (index is defined), clear the stack
    // Otherwise, dismiss the widget sidebar (until page refresh)
    if (index !== undefined) {
      clear()
    } else {
      setWidgetSidebarDismissed(true)
    }
  }

  // Check if we're in multi-column mode
  const isMultiColumn = layoutMode === LAYOUT_MODE.FULL_WIDTH && deckViewMode === DECK_VIEW_MODE.MULTI_COLUMN

  // In multi-column mode or no widgets enabled, render an invisible placeholder to maintain layout
  if (isMultiColumn || enabledWidgets.length === 0) {
    return <div className="h-full w-full bg-transparent" ref={ref} />
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      hideTitlebar
    >
      <div className="px-4 pt-4 pb-4 bg-transparent">
        {/* Title Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className="h-5 w-5" />}
            <h2 className="text-lg font-semibold">{widgetSidebarTitle}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t('Widgets Settings')}
              onClick={() => push(toWidgetsSettings())}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t('close')}
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Widgets />
      </div>
    </SecondaryPageLayout>
  )
})
HomePage.displayName = 'HomePage'
export default HomePage
