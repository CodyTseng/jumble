import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Dispatch } from 'react'
import AccountManager from '../AccountManager'

export default function LoginDialog({
  open,
  setOpen
}: {
  open: boolean
  setOpen: Dispatch<boolean>
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-96">
        <DialogHeader>
          <DialogTitle className="hidden" />
          <DialogDescription className="hidden" />
        </DialogHeader>
        <AccountManager close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
