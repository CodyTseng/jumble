import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle
} from '@/components/ui/drawer'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTranslation } from 'react-i18next'

export default function LogoutDialog({
  open = false,
  setOpen
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { account, removeAccount } = useNostr()

  if (isSmallScreen) {
    return (
      <Drawer defaultOpen={false} open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="grid gap-1.5 p-4 text-center sm:text-start">
            <DrawerTitle>{t('Logout')}</DrawerTitle>
            <DrawerDescription>{t('Are you sure you want to logout?')}</DrawerDescription>
          </div>
          <div className="mt-auto flex flex-col gap-2 px-4 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (account) {
                  setOpen(false)
                  removeAccount(account)
                }
              }}
              className="w-full"
            >
              {t('Logout')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <AlertDialog defaultOpen={false} open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Logout')}</AlertDialogTitle>
          <AlertDialogDescription>{t('Are you sure you want to logout?')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (account) {
                removeAccount(account)
              }
            }}
          >
            {t('Logout')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
