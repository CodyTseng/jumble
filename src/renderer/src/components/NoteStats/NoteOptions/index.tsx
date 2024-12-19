import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { getSharableEventId } from '@renderer/lib/event'
import { Code, Copy, Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RawEventDialog from './RawEventDialog'

export default function NoteOptions({ event }: { event: Event }) {
  const { t } = useTranslation()
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)

  return (
    <div className="h-4" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Ellipsis
            size={16}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent collisionPadding={8}>
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText('nostr:' + getSharableEventId(event))}
          >
            <Copy />
            {t('copy embedded code')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsRawEventDialogOpen(true)}>
            <Code />
            {t('raw event')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RawEventDialog
        event={event}
        isOpen={isRawEventDialogOpen}
        onClose={() => setIsRawEventDialogOpen(false)}
      />
    </div>
  )
}
