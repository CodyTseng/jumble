import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import Username from '../Username'

export default function AboutInfoDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jumble</DialogTitle>
          <DialogDescription>
            A beautiful nostr client focused on browsing relay feeds
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
