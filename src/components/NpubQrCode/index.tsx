import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { QrCodeIcon } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useMemo } from 'react'
import Nip05 from '../Nip05'
import PubkeyCopy from '../PubkeyCopy'
import QrCode from '../QrCode'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function NpubQrCode({ pubkey }: { pubkey: string }) {
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])
  if (!npub) return null

  const trigger = (
    <div className="bg-muted text-muted-foreground hover:text-foreground flex h-5 w-5 flex-col items-center justify-center rounded-full">
      <QrCodeIcon size={14} />
    </div>
  )

  const content = (
    <div className="flex w-full flex-col items-center gap-4 p-8">
      <div className="pointer-events-none flex w-full items-center gap-2 px-1">
        <UserAvatar size="big" userId={pubkey} />
        <div className="w-0 flex-1">
          <Username userId={pubkey} className="truncate text-2xl font-semibold" />
          <Nip05 pubkey={pubkey} />
        </div>
      </div>
      <QrCode size={512} value={`nostr:${npub}`} />
      <div className="flex flex-col items-center">
        <PubkeyCopy pubkey={pubkey} />
      </div>
    </div>
  )

  return (
    <Dialog>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent
        className="m-0 w-80"
        bodyClassName="p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {content}
      </DialogContent>
    </Dialog>
  )
}
