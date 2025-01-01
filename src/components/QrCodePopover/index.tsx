import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { QrCode } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo } from 'react'

export default function QrCodePopover({ pubkey }: { pubkey: string }) {
  const { isSmallScreen } = useScreenSize()
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])
  if (!npub) return null

  if (isSmallScreen) {
    return (
      <Drawer>
        <DrawerTrigger>
          <div className="bg-muted rounded-full h-5 w-5 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground">
            <QrCode size={14} />
          </div>
        </DrawerTrigger>
        <DrawerContent className="h-1/2">
          <div className="flex justify-center items-center h-full">
            <QRCodeSVG size={300} value={`nostr:${npub}`} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover>
      <PopoverTrigger>
        <div className="bg-muted rounded-full h-5 w-5 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground">
          <QrCode size={14} />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-fit h-fit">
        <QRCodeSVG value={`nostr:${npub}`} />
      </PopoverContent>
    </Popover>
  )
}
