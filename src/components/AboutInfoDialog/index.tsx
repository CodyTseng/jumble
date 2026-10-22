import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { CODY_PUBKEY } from '@/constants'
import { useState } from 'react'
import Username from '../Username'

export default function AboutInfoDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const content = (
    <>
      <div className="text-xl font-semibold">Jumble</div>
      <div className="text-muted-foreground">
        A user-friendly Nostr client for exploring relay feeds
      </div>
      <div>
        Made by <Username userId={CODY_PUBKEY} className="text-primary inline-block" showAt />
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
        <div className="text-muted-foreground text-sm">
          If you like Jumble, please consider giving it a star ⭐
        </div>
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}
