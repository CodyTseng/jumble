import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle
} from '@/components/ui/drawer'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import dmService from '@/services/dm.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { Loader2 } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function KeySyncRequestHandler() {
  const { pubkey, signEvent } = useNostr()
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [pendingEvent, setPendingEvent] = useState<Event | null>(null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!pubkey) return

    const unsub = dmService.onSyncRequest((event) => {
      setPendingEvent(event)
    })

    return unsub
  }, [pubkey])

  const handleSendKey = async () => {
    if (!pubkey || !pendingEvent) return

    const clientPubkey = encryptionKeyService.getClientPubkeyFromEvent(pendingEvent)
    if (!clientPubkey) return

    setIsSending(true)
    try {
      const signer = {
        getPublicKey: async () => pubkey,
        signEvent
      }

      await encryptionKeyService.exportKeyForTransfer(signer as any, pubkey, clientPubkey)
      dmService.markSyncRequestProcessed(pendingEvent.id)
      toast.success(t('Encryption key sent to other device'))
      setPendingEvent(null)
    } catch (error) {
      console.error('Failed to send key:', error)
      toast.error(t('Failed to send encryption key'))
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    if (pendingEvent) {
      dmService.markSyncRequestProcessed(pendingEvent.id)
    }
    setPendingEvent(null)
  }

  const open = !!pendingEvent
  const onOpenChange = (v: boolean) => !v && handleClose()

  const clientPubkey = pendingEvent
    ? encryptionKeyService.getClientPubkeyFromEvent(pendingEvent)
    : null
  const verificationCode = clientPubkey
    ? encryptionKeyService.getVerificationCode(clientPubkey)
    : ''

  const deviceInfo = (
    <div className="flex flex-col gap-3">
      <div className="bg-muted flex flex-col items-center gap-2 rounded-lg p-4">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t('Pairing code')}
        </span>
        <div className="font-mono text-2xl font-semibold tracking-[0.2em]">{verificationCode}</div>
      </div>
      <p className="text-muted-foreground text-center text-sm">
        {t(
          'To avoid sending your encryption key to an unknown device, check that this code matches the one shown on the other device.'
        )}
      </p>
    </div>
  )

  const sendKeyButton = (
    <Button onClick={handleSendKey} disabled={isSending} className={isSmallScreen ? 'w-full' : ''}>
      {isSending ? (
        <>
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
          {t('Sending...')}
        </>
      ) : (
        t('Send Key')
      )}
    </Button>
  )

  const dismissButton = (
    <Button
      variant="outline"
      onClick={handleClose}
      disabled={isSending}
      className={isSmallScreen ? 'w-full' : ''}
    >
      {t('Dismiss')}
    </Button>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="grid gap-1.5 p-4 text-center sm:text-start">
            <DrawerTitle>{t('Key sync request')}</DrawerTitle>
            <DrawerDescription>
              {t('Another device is requesting your encryption key.')}
            </DrawerDescription>
          </div>
          <div className="px-4">{deviceInfo}</div>
          <div className="mt-auto flex flex-col gap-2 px-4 pt-4">
            {sendKeyButton}
            {dismissButton}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Key sync request')}</DialogTitle>
          <DialogDescription>
            {t('Another device is requesting your encryption key.')}
          </DialogDescription>
        </DialogHeader>
        {deviceInfo}
        <DialogFooter>
          {dismissButton}
          {sendKeyButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
