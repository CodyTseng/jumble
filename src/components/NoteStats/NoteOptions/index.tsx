import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { getSharableEventId } from '@/lib/event'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Bell, BellOff, Code, Copy, Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RawEventDialog from './RawEventDialog'

export default function NoteOptions({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const { mutePubkey, unmutePubkey, mutePubkeys } = useMuteList()
  const isMuted = useMemo(() => mutePubkeys.includes(event.pubkey), [mutePubkeys, event])

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
            onClick={() => navigator.clipboard.writeText(getSharableEventId(event))}
          >
            <Copy />
            {t('Copy event ID')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(pubkeyToNpub(event.pubkey) ?? '')}
          >
            <Copy />
            {t('Copy user ID')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsRawEventDialogOpen(true)}>
            <Code />
            {t('View raw event')}
          </DropdownMenuItem>
          {pubkey && (
            <DropdownMenuItem
              onClick={() => (isMuted ? unmutePubkey(event.pubkey) : mutePubkey(event.pubkey))}
              className="text-destructive focus:text-destructive"
            >
              {isMuted ? <Bell /> : <BellOff />}
              {isMuted ? t('Unmute user') : t('Mute user')}
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
