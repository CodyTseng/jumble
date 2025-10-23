import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { CODY_PUBKEY } from '@/constants'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useState } from 'react'
import Username from '../Username'

export default function AboutInfoDialog({ children }: { children: React.ReactNode }) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const content = (
    <>
      <div className="text-xl font-semibold">Jumble</div>
      <div className="text-muted-foreground">
        A user-friendly Nostr client for exploring relay feeds
      </div>
      <div>
        Made by <Username userId={CODY_PUBKEY} className="inline-block text-primary" showAt />
      </div>
      <div>
        Source code:{' '}
        <a
          href="https://github.com/CodyTseng/jumble"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          GitHub
        </a>
        <div className="text-sm text-muted-foreground">
          If you like Jumble, please consider giving it a star ⭐
        </div>
      </div>
    </>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <div className="p-4 space-y-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}
