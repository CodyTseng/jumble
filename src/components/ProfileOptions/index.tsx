import Nip05 from '@/components/Nip05'
import PrivateNoteDialog from '@/components/PrivateNoteDialog'
import PubkeyCopy from '@/components/PubkeyCopy'
import QrCodeComponent from '@/components/QrCode'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Bell, BellOff, Copy, Ellipsis, QrCode, StickyNote } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ProfileOptions({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeySet, mutePubkeyPrivately, mutePubkeyPublicly, unmutePubkey } = useMuteList()
  const isMuted = useMemo(() => mutePubkeySet.has(pubkey), [mutePubkeySet, pubkey])
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [isQrCodeOpen, setIsQrCodeOpen] = useState(false)

  if (pubkey === accountPubkey) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(pubkeyToNpub(pubkey) ?? '')}>
            <Copy />
            {t('Copy public key')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsQrCodeOpen(true)}>
            <QrCode />
            {t('Show QR code')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsNoteDialogOpen(true)}>
            <StickyNote />
            {t('Add private note')}
          </DropdownMenuItem>
          {isMuted ? (
            <DropdownMenuItem
              onClick={() => unmutePubkey(pubkey)}
              className="text-destructive focus:text-destructive"
            >
              <Bell />
              {t('Unmute user')}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => mutePubkeyPrivately(pubkey)}
                className="text-destructive focus:text-destructive"
              >
                <BellOff />
                {t('Mute user privately')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => mutePubkeyPublicly(pubkey)}
                className="text-destructive focus:text-destructive"
              >
                <BellOff />
                {t('Mute user publicly')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <PrivateNoteDialog
        open={isNoteDialogOpen}
        onOpenChange={setIsNoteDialogOpen}
        pubkey={pubkey}
      />
      <NpubQrCodeDialog
        open={isQrCodeOpen}
        onOpenChange={setIsQrCodeOpen}
        pubkey={pubkey}
      />
    </>
  )
}

function NpubQrCodeDialog({
  pubkey,
  open,
  onOpenChange
}: {
  pubkey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void
}) {
  const { isSmallScreen } = useScreenSize()
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])

  if (!npub) return null

  const content = (
    <div className="w-full flex flex-col items-center gap-4 p-8">
      <div className="flex items-center w-full gap-2 pointer-events-none px-1">
        <UserAvatar size="md" userId={pubkey} />
        <div className="flex-1 w-0">
          <Username userId={pubkey} className="text-base font-semibold truncate" />
          <Nip05 pubkey={pubkey} />
        </div>
      </div>
      <QrCodeComponent size={256} value={`nostr:${npub}`} />
      <div className="flex flex-col items-center">
        <PubkeyCopy pubkey={pubkey} />
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>{content}</DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 m-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        {content}
      </DialogContent>
    </Dialog>
  )
}
