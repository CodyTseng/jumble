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
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import storage from '@/services/local-storage.service'
import systemNotification from '@/services/system-notification'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function SystemNotificationPermissionPrompt() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { enableDm } = useUserPreferences()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (
      !pubkey ||
      storage.getSystemNotificationsEnabled() ||
      storage.getSystemNotificationsPrompted()
    ) {
      setOpen(false)
      return
    }

    let cancelled = false
    void Promise.all([systemNotification.isSupported(), systemNotification.getPermission()]).then(
      ([supported, permission]) => {
        if (cancelled || !supported) return
        if (storage.getSystemNotificationsEnabled() || storage.getSystemNotificationsPrompted()) {
          return
        }

        if (permission === 'granted') {
          storage.setSystemNotificationsEnabled(true)
          storage.setSystemNotificationsPrompted(true)
          return
        }
        if (permission === 'denied') {
          storage.setSystemNotificationsPrompted(true)
          return
        }
        setOpen(true)
      }
    )

    return () => {
      cancelled = true
    }
  }, [pubkey])

  const handleDismiss = () => {
    storage.setSystemNotificationsPrompted(true)
    setOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open) {
      storage.setSystemNotificationsPrompted(true)
    }
    setOpen(nextOpen)
  }

  const handleEnable = () => {
    storage.setSystemNotificationsPrompted(true)
    setOpen(false)
    void systemNotification.requestPermission().then((permission) => {
      const enabled = permission === 'granted'
      storage.setSystemNotificationsEnabled(enabled)
      if (!enabled) {
        toast.error(t('Notification permission was not granted'))
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Enable system notifications?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {enableDm
              ? t(
                  'Get notified about new mentions, reactions, zaps, and private messages while Jumble is running in the background.'
                )
              : t('Show notifications while Jumble is running in the background')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>{t('Not now')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleEnable}>{t('Enable')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
