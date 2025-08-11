import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { QrCodeIcon } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useMemo } from 'react'
import Nip05 from '../Nip05'
import PubkeyCopy from '../PubkeyCopy'
import QrCode from '../QrCode'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function NpubQrCode({ pubkey }: { pubkey: string }) {
  const { isSmallScreen } = useScreenSize()
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])
  if (!npub) return null

  const trigger = (
    <div className="bg-muted rounded-full h-5 w-5 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground">
      <QrCodeIcon size={14} />
    </div>
  )

  const content = (
    <div className="w-full flex flex-col items-center gap-4 p-8">
      <div className="flex items-center w-full gap-2 pointer-events-none px-1">
        <UserAvatar size="big" userId={pubkey} />
        <div className="flex-1 w-0">
          <Username userId={pubkey} className="text-2xl font-semibold truncate" />
          <Nip05 pubkey={pubkey} />
        </div>
      </div>
      <QrCode size={512} value={`nostr:${npub}`} />
      <div className="flex flex-col items-center">
        <PubkeyCopy pubkey={pubkey} />
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer>
        <DrawerTrigger>{trigger}</DrawerTrigger>
        <DrawerContent>{content}</DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="w-80 p-0 m-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        {content}
      </DialogContent>
    </Dialog>
  )
}
