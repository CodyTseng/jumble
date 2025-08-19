import { toRelay } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

export default function RelayItem({ relay }: { relay: string }) {
  const { push } = useSecondaryPage()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: relay
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      className="relative group clickable flex gap-2 border rounded-lg p-2 pr-2.5 items-center justify-between select-none"
      ref={setNodeRef}
      style={style}
      onClick={() => push(toRelay(relay))}
    >
      <div className="flex items-center gap-1 flex-1">
        <div
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded touch-none shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4 text-muted-foreground" />
        </div>
        <div className="flex gap-2 items-center flex-1">
          <RelayIcon url={relay} />
          <div className="flex-1 w-0 truncate font-semibold">{relay}</div>
        </div>
      </div>
      <SaveRelayDropdownMenu urls={[relay]} />
    </div>
  )
}
