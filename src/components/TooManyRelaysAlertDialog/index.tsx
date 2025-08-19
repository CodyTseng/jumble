import {
  AlertDialog,
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { toRelaySettings } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import storage from '@/services/local-storage.service'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function TooManyRelaysAlertDialog() {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const { relayList } = useNostr()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dismissed = storage.getDismissedTooManyRelaysAlert()
    if (dismissed) return

    if (relayList && (relayList.read.length > 4 || relayList.write.length > 4)) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [relayList])

  if (!relayList) return null

  const handleFixNow = () => {
    setOpen(false)
    push(toRelaySettings('mailbox'))
  }

  const handleDismiss = () => {
    storage.setDismissedTooManyRelaysAlert(true)
    setOpen(false)
  }

  const handleMaybeLater = () => {
    setOpen(false)
  }

  const title = t('Optimize Relay Settings')
  const description = t(
    'Your current relay configuration may not be optimal. This could make it difficult for others to find your posts and may result in incomplete notifications.'
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button onClick={handleFixNow}>{t('Optimize Now')}</Button>
            <Button variant="outline" onClick={handleMaybeLater}>
              {t('Maybe Later')}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="link"
              className="text-muted-foreground text-xs"
            >
              {t("Don't remind me again")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={handleDismiss} variant="link" className="text-muted-foreground text-xs">
            {t("Don't remind me again")}
          </Button>
          <Button variant="outline" onClick={handleMaybeLater}>
            {t('Maybe Later')}
          </Button>
          <Button onClick={handleFixNow}>{t('Optimize Now')}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
