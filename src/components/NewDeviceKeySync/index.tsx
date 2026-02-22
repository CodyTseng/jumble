import ResetEncryptionKeyButton from '@/components/ResetEncryptionKeyButton'
import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import encryptionKeyService from '@/services/encryption-key.service'
import { getClientDescription } from '@/lib/utils'
import { CheckCircle, Loader2, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type TSetupState = 'loading' | 'publishing' | 'waiting' | 'success' | 'error'

export default function NewDeviceKeySync({ onComplete }: { onComplete?: () => void }) {
  const { t } = useTranslation()
  const { pubkey, signEvent } = useNostr()
  const [state, setState] = useState<TSetupState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pubkey) return

    let unsubscribe: (() => void) | null = null

    const setup = async () => {
      try {
        if (encryptionKeyService.hasEncryptionKey(pubkey)) {
          setState('success')
          onComplete?.()
          return
        }

        setState('publishing')

        const signer = {
          getPublicKey: async () => pubkey,
          signEvent,
          nip44Encrypt: async (privkey: Uint8Array, pk: string, text: string) => {
            return encryptionKeyService.encryptWithNip44(privkey, pk, text)
          },
          nip44Decrypt: async (privkey: Uint8Array, pk: string, text: string) => {
            return encryptionKeyService.decryptWithNip44(privkey, pk, text)
          }
        }

        await encryptionKeyService.publishClientKeyAnnouncement(signer as any, pubkey, getClientDescription())
        setState('waiting')

        unsubscribe = await encryptionKeyService.subscribeToKeyTransfer(
          signer as any,
          pubkey,
          (success) => {
            if (success) {
              setState('success')
              toast.success(t('Encryption key synced successfully'))
              setTimeout(() => onComplete?.(), 1000)
            } else {
              setError(t('Failed to import encryption key'))
              setState('error')
            }
          }
        )
      } catch (err) {
        setError((err as Error).message)
        setState('error')
      }
    }

    setup()

    return () => {
      unsubscribe?.()
    }
  }, [pubkey])

  const handleGenerateNew = async () => {
    if (!pubkey) return

    try {
      const signer = {
        getPublicKey: async () => pubkey,
        signEvent
      }

      encryptionKeyService.generateEncryptionKey(pubkey)
      await encryptionKeyService.publishEncryptionKeyAnnouncement(signer as any, pubkey)
      toast.success(t('New encryption key generated'))
      onComplete?.()
    } catch {
      toast.error(t('Failed to generate encryption key'))
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('Checking encryption key...')}</p>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-sm font-medium">{t('Encryption key synced!')}</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>{t('Try Again')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center p-6 space-y-6">
      <Smartphone className="h-16 w-16 text-muted-foreground" />

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{t('Sync Encryption Key')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t(
            'An encryption key was found for your account. Open Jumble on another device where you have already set up DMs to sync the key.'
          )}
        </p>
      </div>

      {state === 'publishing' && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('Publishing sync request...')}</span>
        </div>
      )}

      {state === 'waiting' && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('Waiting for key from another device...')}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {t('Open your other device and go to Messages to send the encryption key to this device.')}
          </p>
        </div>
      )}

      <div className="border-t pt-4 w-full space-y-3">
        <p className="text-xs text-muted-foreground text-center">
          {t("Don't have access to another device? You can reset your encryption key to generate a new one, but you will no longer be able to decrypt messages sent with the old key.")}
        </p>
        <ResetEncryptionKeyButton onConfirm={handleGenerateNew} className="w-full" />
      </div>
    </div>
  )
}
