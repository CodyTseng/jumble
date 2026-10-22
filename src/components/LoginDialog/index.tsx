import { Dialog, DialogContent } from '@/components/ui/dialog'
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
      <DialogContent className="max-h-[90vh] w-[520px]" bodyClassName="overflow-auto py-8">
        <AccountManager close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
