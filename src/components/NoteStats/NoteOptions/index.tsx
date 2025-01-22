import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { getSharableEventId } from '@/lib/event'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { BellOff, Code, Copy, Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RawEventDialog from './RawEventDialog'

export default function NoteOptions({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const { mutePubkey } = useMuteList()

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
          {pubkey && (
            <DropdownMenuItem
              onClick={() => mutePubkey(event.pubkey)}
              className="text-destructive focus:text-destructive"
            >
              <BellOff />
              {t('mute author')}
            </DropdownMenuItem>
          )}
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
