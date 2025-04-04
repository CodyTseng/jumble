import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { getSharableEventId } from '@/lib/event'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Bell, BellOff, Code, Copy, Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RawEventDialog from './RawEventDialog'

export default function NoteOptions({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey } = useNostr()
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { mutePubkey, unmutePubkey, mutePubkeys } = useMuteList()
  const isMuted = useMemo(() => mutePubkeys.includes(event.pubkey), [mutePubkeys, event])

  const trigger = (
    <button
      className="flex items-center text-muted-foreground hover:text-foreground pl-3 h-full"
      onClick={() => setIsDrawerOpen(true)}
    >
      <Ellipsis />
    </button>
  )

  const rawEventDialog = (
    <RawEventDialog
      event={event}
      isOpen={isRawEventDialogOpen}
      onClose={() => setIsRawEventDialogOpen(false)}
    />
  )

  if (isSmallScreen) {
    return (
      <div className={className} onClick={(e) => e.stopPropagation()}>
        {trigger}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay onClick={() => setIsDrawerOpen(false)} />
          <DrawerContent hideOverlay>
            <div className="py-2">
              <Button
                onClick={() => {
                  setIsDrawerOpen(false)
                  navigator.clipboard.writeText(getSharableEventId(event))
                }}
                className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5"
                variant="ghost"
              >
                <Copy />
                {t('Copy event ID')}
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(pubkeyToNpub(event.pubkey) ?? '')
                  setIsDrawerOpen(false)
                }}
                className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5"
                variant="ghost"
              >
                <Copy />
                {t('Copy user ID')}
              </Button>
              <Button
                onClick={() => {
                  setIsDrawerOpen(false)
                  setIsRawEventDialogOpen(true)
                }}
                className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5"
                variant="ghost"
              >
                <Code />
                {t('View raw event')}
              </Button>
              {pubkey && (
                <Button
                  onClick={() => {
                    setIsDrawerOpen(false)
                    if (isMuted) {
                      unmutePubkey(event.pubkey)
                    } else {
                      mutePubkey(event.pubkey)
                    }
                  }}
                  className="w-full p-6 justify-start text-destructive text-lg gap-4 [&_svg]:size-5 focus:text-destructive"
                  variant="ghost"
                >
                  {isMuted ? <Bell /> : <BellOff />}
                  {isMuted ? t('Unmute user') : t('Mute user')}
                </Button>
              )}
            </div>
          </DrawerContent>
        </Drawer>
        {rawEventDialog}
      </div>
    )
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsRawEventDialogOpen(true)}>
            <Code />
            {t('View raw event')}
          </DropdownMenuItem>
          {pubkey && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => (isMuted ? unmutePubkey(event.pubkey) : mutePubkey(event.pubkey))}
                className="text-destructive focus:text-destructive"
              >
                {isMuted ? <Bell /> : <BellOff />}
                {isMuted ? t('Unmute user') : t('Mute user')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {rawEventDialog}
    </div>
  )
}
