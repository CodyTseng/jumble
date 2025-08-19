import { useSecondaryPage } from '@/PageManager'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toRelay } from '@/lib/link'
import { TMailboxRelay, TMailboxRelayScope } from '@/types'
import { CircleX, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import RelayIcon from '../RelayIcon'

export default function MailboxRelay({
  mailboxRelay,
  changeMailboxRelayScope,
  removeMailboxRelay
}: {
  mailboxRelay: TMailboxRelay
  changeMailboxRelayScope: (url: string, scope: TMailboxRelayScope) => void
  removeMailboxRelay: (url: string) => void
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mailboxRelay.url
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1 w-0">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded touch-none"
          style={{ touchAction: 'none' }}
        >
          <GripVertical size={16} className="text-muted-foreground" />
        </div>
        <div
          className="flex items-center gap-2 flex-1 w-0 cursor-pointer"
          onClick={() => push(toRelay(mailboxRelay.url))}
        >
          <RelayIcon url={mailboxRelay.url} />
          <div className="truncate">{mailboxRelay.url}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Select
          value={mailboxRelay.scope}
          onValueChange={(v: TMailboxRelayScope) => changeMailboxRelayScope(mailboxRelay.url, v)}
        >
          <SelectTrigger className="w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">{t('R & W')}</SelectItem>
            <SelectItem value="read">{t('Read')}</SelectItem>
            <SelectItem value="write">{t('Write')}</SelectItem>
          </SelectContent>
        </Select>
        <CircleX
          size={16}
          onClick={() => removeMailboxRelay(mailboxRelay.url)}
          className="text-muted-foreground hover:text-destructive clickable"
        />
      </div>
    </div>
  )
}
