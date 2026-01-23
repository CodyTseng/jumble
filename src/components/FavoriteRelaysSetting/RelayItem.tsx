import { IS_COMMUNITY_MODE } from '@/constants'
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
      className="clickable group relative flex select-none items-center justify-between gap-2 rounded-lg border p-2 pr-2.5"
      ref={setNodeRef}
      style={style}
      onClick={() => push(toRelay(relay))}
    >
      <div className="flex flex-1 items-center gap-1">
        <div
          className="shrink-0 cursor-grab touch-none rounded p-2 hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-1 items-center gap-2">
          <RelayIcon url={relay} />
          <div className="w-0 flex-1 truncate font-semibold">{relay}</div>
        </div>
      </div>
      {!IS_COMMUNITY_MODE && <SaveRelayDropdownMenu urls={[relay]} />}
    </div>
  )
}
