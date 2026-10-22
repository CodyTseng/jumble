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
import { useNostr } from '@/providers/NostrProvider'
import { useTranslation } from 'react-i18next'

export default function LogoutDialog({
  open = false,
  setOpen
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { t } = useTranslation()

  const { account, removeAccount } = useNostr()

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
