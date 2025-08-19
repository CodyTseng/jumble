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
import PullRelaySetsButton from './PullRelaySetsButton'
import RelaySet from './RelaySet'

export default function RelaySetList() {
  const { t } = useTranslation()
  const { relaySets, reorderRelaySets } = useFavoriteRelays()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = relaySets.findIndex((item) => item.id === active.id)
      const newIndex = relaySets.findIndex((item) => item.id === over.id)

      const reorderedSets = arrayMove(relaySets, oldIndex, newIndex)
      reorderRelaySets(reorderedSets)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground font-semibold select-none shrink-0">
          {t('Relay sets')}
        </div>
        <PullRelaySetsButton />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={relaySets.map((set) => set.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-2">
            {relaySets.map((relaySet) => (
              <RelaySet key={relaySet.id} relaySet={relaySet} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
