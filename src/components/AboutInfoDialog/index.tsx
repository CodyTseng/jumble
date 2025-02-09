import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useState } from 'react'
import Username from '../Username'
import ZapDialog from '../ZapDialog'

export default function AboutInfoDialog({ children }: { children: React.ReactNode }) {
  const { isSmallScreen } = useScreenSize()
  const { checkLogin } = useNostr()
  const [openZapDialog, setOpenZapDialog] = useState(false)
  const pubkey = '8125b911ed0e94dbe3008a0be48cfe5cd0c0b05923cfff917ae7e87da8400883'

  const content = (
    <>
      <div className="text-xl font-semibold">Jumble</div>
      <div className="text-muted-foreground">
        A beautiful nostr client focused on browsing relay feeds
      </div>
      <div>
        Made by <Username userId={pubkey} className="inline-block text-primary" showAt />
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
      </div>
      <div>
        If you like this project, you can buy me a coffee ☕️ <br />
      </div>
      <Button
        className="bg-yellow-400 hover:bg-yellow-400/90"
        onClick={() => checkLogin(() => setOpenZapDialog(true))}
      >
        ⚡️ codytseng@getalby.com ⚡️
      </Button>
      <div className="text-muted-foreground">
        Version: v{__APP_VERSION__} ({__GIT_COMMIT__})
      </div>
      <ZapDialog open={openZapDialog} setOpen={setOpenZapDialog} pubkey={pubkey} />
    </>
  )

  if (isSmallScreen) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <div className="p-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}
