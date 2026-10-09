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
import MailboxRelayIndicator from '../RelayObservations/MailboxRelayIndicator'

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
      <div className="flex w-0 flex-1 items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="hover:bg-muted cursor-grab touch-none rounded p-2 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <GripVertical size={16} className="text-muted-foreground" />
        </div>
        <MailboxRelayIndicator url={mailboxRelay.url} scope={mailboxRelay.scope} />
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
          onClick={() => push(toRelay(mailboxRelay.url))}
        >
          <RelayIcon url={mailboxRelay.url} />
          <span className="w-0 flex-1 truncate">{mailboxRelay.url}</span>
        </button>
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
          className="clickable text-muted-foreground hover:text-destructive"
        />
      </div>
    </div>
  )
}
