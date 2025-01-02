import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer'
import Username from '../Username'

export default function AboutInfoDialog({ children }: { children: React.ReactNode }) {
  const { isSmallScreen } = useScreenSize()

  const content = (
    <>
      <div className="text-xl font-semibold">Jumble</div>
      <div className="text-muted-foreground">
        A beautiful nostr client focused on browsing relay feeds
      </div>
      <div>
        Made by{' '}
        <Username
          userId={'npub1syjmjy0dp62dhccq3g97fr87tngvpvzey08llyt6ul58m2zqpzps9wf6wl'}
          className="inline-block text-primary"
          showAt
        />
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
        <div className="font-semibold">⚡️ codytseng@getalby.com ⚡️</div>
      </div>
      <div className="text-muted-foreground">
        Version: v{__APP_VERSION__} ({__GIT_COMMIT__})
      </div>
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
