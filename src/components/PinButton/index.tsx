import { Button } from '@/components/ui/button'
import { DECK_VIEW_MODE, LAYOUT_MODE } from '@/constants'
import { cn } from '@/lib/utils'
import { useDeckView } from '@/providers/DeckViewProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { TPinnedColumn } from '@/types'
import { Pin, PinOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type PinButtonProps = {
  column: Omit<TPinnedColumn, 'id'>
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'titlebar-icon'
}

export default function PinButton({ column, className, variant = 'ghost', size = 'sm' }: PinButtonProps) {
  const { t } = useTranslation()
  const { layoutMode } = useLayoutMode()
  const { deckViewMode, pinnedColumns, pinColumn, unpinColumn } = useDeckView()

  // Only show pin button if we're in full-width mode with multi-column deck
  if (layoutMode !== LAYOUT_MODE.FULL_WIDTH || deckViewMode !== DECK_VIEW_MODE.MULTI_COLUMN) {
    return null
  }

  // Check if this column is already pinned
  const isPinned = pinnedColumns.some(
    (col) =>
      col.type === column.type &&
      JSON.stringify(col.props) === JSON.stringify(column.props)
  )

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPinned) {
      const pinnedColumn = pinnedColumns.find(
        (col) =>
          col.type === column.type &&
          JSON.stringify(col.props) === JSON.stringify(column.props)
      )
      if (pinnedColumn) {
        unpinColumn(pinnedColumn.id)
      }
    } else {
      pinColumn(column)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(isPinned && 'text-primary', className)}
      title={isPinned ? t('Unpin column') : t('Pin as new column')}
      aria-label={isPinned ? t('Unpin column') : t('Pin as new column')}
      aria-pressed={isPinned}
    >
      {isPinned ? <PinOff className="size-4" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
    </Button>
  )
}
