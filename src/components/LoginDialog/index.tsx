import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Dispatch } from 'react'
import AccountManager from '../AccountManager'

export default function LoginDialog({
  open,
  setOpen
}: {
  open: boolean
  setOpen: Dispatch<boolean>
}) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90vh]">
          <div className="flex flex-col p-4 gap-4 overflow-auto">
            <AccountManager close={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[520px] max-h-[90vh] py-8 overflow-auto">
        <AccountManager close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
