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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import dmService from '@/services/dm.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { Loader2, Smartphone } from 'lucide-react'
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
        signEvent,
        nip44Encrypt: async (privkey: Uint8Array, pk: string, text: string) => {
          return encryptionKeyService.encryptWithNip44(privkey, pk, text)
        }
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

  const clientTag = pendingEvent?.tags.find((t) => t[0] === 'client')
  const clientName = clientTag?.[1] || t('Unknown device')

  const deviceInfo = (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
      <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="font-medium truncate">{clientName}</span>
    </div>
  )

  const sendKeyButton = (
    <Button onClick={handleSendKey} disabled={isSending} className={isSmallScreen ? 'w-full' : ''}>
      {isSending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
          <DrawerHeader>
            <DrawerTitle>{t('Key sync request')}</DrawerTitle>
            <DrawerDescription>
              {t('Another device is requesting your encryption key.')}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">{deviceInfo}</div>
          <DrawerFooter>
            {sendKeyButton}
            {dismissButton}
          </DrawerFooter>
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
