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
        <DrawerContent className="max-h-[90dvh]">
          <div className="flex flex-col gap-4 overflow-auto p-4">
            <AccountManager close={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[520px] overflow-auto py-8">
        <AccountManager close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
