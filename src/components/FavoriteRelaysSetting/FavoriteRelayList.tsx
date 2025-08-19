import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import RelayItem from './RelayItem'

export default function FavoriteRelayList() {
  const { t } = useTranslation()
  const { favoriteRelays, reorderFavoriteRelays } = useFavoriteRelays()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = favoriteRelays.findIndex((relay) => relay === active.id)
      const newIndex = favoriteRelays.findIndex((relay) => relay === over.id)

      const reorderedRelays = arrayMove(favoriteRelays, oldIndex, newIndex)
      reorderFavoriteRelays(reorderedRelays)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground font-semibold select-none">{t('Relays')}</div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={favoriteRelays} strategy={verticalListSortingStrategy}>
          <div className="grid gap-2">
            {favoriteRelays.map((relay) => (
              <RelayItem key={relay} relay={relay} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
