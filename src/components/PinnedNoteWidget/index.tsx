import WidgetContainer from '@/components/WidgetContainer'
import NoteCard from '@/components/NoteCard'
import { useWidgets } from '@/providers/WidgetsProvider'
import { useFetchEvent } from '@/hooks/useFetchEvent'
import { Loader2, Pin, X } from 'lucide-react'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import React from 'react'

interface PinnedNoteWidgetProps {
  widgetId: string
  eventId: string
}

export default function PinnedNoteWidget({ widgetId, eventId }: PinnedNoteWidgetProps) {
  const { t } = useTranslation()
  const { unpinNoteWidget } = useWidgets()
  const { event, isFetching } = useFetchEvent(eventId)
  const [isHovered, setIsHovered] = React.useState(false)

  const handleUnpin = () => {
    unpinNoteWidget(widgetId)
  }

  return (
    <WidgetContainer>
      <CardHeader
        className="flex flex-row items-center justify-between space-y-0 p-4 pb-3 border-b group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardTitle className="font-semibold flex items-center gap-2" style={{ fontSize: '14px' }}>
          <Pin className="h-4 w-4" />
          {t('Pinned Note')}
        </CardTitle>
        {isHovered && (
          <button
            className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            onClick={handleUnpin}
            title={t('Unpin from sidebar')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </CardHeader>
      <div className="px-4 pb-4">
        {isFetching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isFetching && !event && (
          <div className="text-center text-sm text-muted-foreground py-8">
            {t('Note not found')}
          </div>
        )}
        {event && <NoteCard event={event} hideSeparator />}
      </div>
    </WidgetContainer>
  )
}
