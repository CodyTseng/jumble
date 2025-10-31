import { useWidgets, TWidgetId } from '@/providers/WidgetsProvider'
import { usePageTheme } from '@/providers/PageThemeProvider'
import TrendingNotesWidget from '@/components/TrendingNotes/TrendingNotesWidget'
import BitcoinTickerWidget from '@/components/BitcoinTicker/BitcoinTickerWidget'
import PinnedNoteWidget from '@/components/PinnedNoteWidget'
import AIPromptWidget from '@/components/AIPromptWidget'
import SidebarAIPromptWidget from '@/components/AIPromptWidget/SidebarAIPromptWidget'
import { TourWelcomeWidget } from '@/components/TourWidget'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  'bitcoin-ticker': BitcoinTickerWidget,
  'trending-notes': TrendingNotesWidget,
  'tour': TourWelcomeWidget,
  'ai-prompt': SidebarAIPromptWidget
}

export default function Widgets() {
  const { enabledWidgets, pinnedNoteWidgets, aiPromptWidgets } = useWidgets()
  const { pageTheme } = usePageTheme()

  // Use border for pure-black and white themes, shadow for others
  const widgetClassName = cn(
    "bg-card overflow-hidden",
    pageTheme === 'pure-black' ? "border border-neutral-900" :
    pageTheme === 'white' ? "border border-border" : "shadow-lg"
  )

  const widgetStyle = { borderRadius: 'var(--card-radius, 8px)' }

  return (
    <>
      {/* Widgets in the sidebar */}
      {enabledWidgets.length > 0 && (
        <div className="space-y-4">
          {enabledWidgets.map((widgetId) => {
            // Check if this is a pinned note widget
            const pinnedNote = pinnedNoteWidgets.find((w) => w.id === widgetId)
            if (pinnedNote) {
              return (
                <div key={widgetId} className={widgetClassName} style={widgetStyle}>
                  <PinnedNoteWidget widgetId={widgetId} eventId={pinnedNote.eventId} />
                </div>
              )
            }

            // Check if this is a floating AI prompt widget (from "Prompt Note" button)
            const floatingAIPrompt = aiPromptWidgets.find((w) => w.id === widgetId)
            if (floatingAIPrompt && widgetId !== 'ai-prompt') {
              // Render floating AI prompts via portal
              return createPortal(
                <AIPromptWidget key={widgetId} widgetId={widgetId} eventId={floatingAIPrompt.eventId} />,
                document.body
              )
            }

            // Otherwise, render a standard widget
            const WidgetComponent = WIDGET_COMPONENTS[widgetId]
            if (!WidgetComponent) return null

            return (
              <div key={widgetId} className={widgetClassName} style={widgetStyle}>
                <WidgetComponent />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
