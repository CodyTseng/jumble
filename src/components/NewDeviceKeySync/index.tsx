import DmRelayConfig from '@/components/DmRelayConfig'
import ResetEncryptionKeyButton from '@/components/ResetEncryptionKeyButton'
import { Button } from '@/components/ui/button'
import { formatError } from '@/lib/error'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import encryptionKeyService from '@/services/encryption-key.service'
import type { TEncryptionKeypair } from '@/types'
import { CheckCircle, Loader2, RefreshCw, Server, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type TSetupState = 'loading' | 'publishing' | 'waiting' | 'success' | 'error'

const RETRY_COOLDOWN = 60

export default function NewDeviceKeySync({ onComplete }: { onComplete?: () => void }) {
  const { t } = useTranslation()
  const { pubkey, signEvent } = useNostr()
  const [state, setState] = useState<TSetupState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(RETRY_COOLDOWN)
  const [showRelayConfig, setShowRelayConfig] = useState(false)
  const [clientPubkey, setClientPubkey] = useState('')
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const clientKeypairRef = useRef<TEncryptionKeypair | null>(null)

  const verificationCode = useMemo(
    () => (clientPubkey ? encryptionKeyService.getVerificationCode(clientPubkey) : ''),
    [clientPubkey]
  )

  const publishAndSubscribe = useCallback(async () => {
    if (!pubkey) return

    try {
      setState('publishing')

      const signer = {
        getPublicKey: async () => pubkey,
        signEvent
      }

      const clientKeypair = encryptionKeyService.generateClientKeypair()
      clientKeypairRef.current = clientKeypair
      setClientPubkey(clientKeypair.pubkey)

      unsubscribeRef.current?.()
      unsubscribeRef.current = await encryptionKeyService.subscribeToKeyTransfer(
        pubkey,
        clientKeypair,
        () => {
          if (clientKeypairRef.current?.pubkey !== clientKeypair.pubkey) return
          setState('success')
          toast.success(t('Encryption key synced successfully'))
          setTimeout(() => onComplete?.(), 1000)
        }
      )

      await encryptionKeyService.publishClientKeyAnnouncement(signer as any, pubkey, clientKeypair)
      if (clientKeypairRef.current?.pubkey === clientKeypair.pubkey) {
        setState((prev) => (prev === 'success' ? prev : 'waiting'))
        setCountdown(RETRY_COOLDOWN)
      }
    } catch (err) {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      setError((err as Error).message)
      setState('error')
    }
  }, [pubkey, signEvent, onComplete, t])

  useEffect(() => {
    if (!pubkey) return

    if (encryptionKeyService.hasEncryptionKey(pubkey)) {
      setState('success')
      onComplete?.()
      return
    }

    publishAndSubscribe()

    return () => {
      unsubscribeRef.current?.()
      clientKeypairRef.current = null
    }
  }, [pubkey])

  useEffect(() => {
    if (state !== 'waiting' || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [state, countdown <= 0])

  const handleRetry = () => {
    unsubscribeRef.current?.()
    publishAndSubscribe()
  }

  const handleRelaysUpdated = async () => {
    setShowRelayConfig(false)
    // DmRelayConfig updates the replaceable event cache asynchronously after
    // publishing. Force a fresh fetch so the retry below subscribes on the
    // newly configured relays rather than the stale cached set.
    if (pubkey) {
      try {
        await client.fetchDmRelaysEvent(pubkey, true, true)
      } catch {
        // ignore; retry falls back to whatever the cache holds
      }
    }
    handleRetry()
  }

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
    } catch (error) {
      console.error('Failed to generate new encryption key', error)
      const messages = formatError(error).filter(Boolean)
      if (messages.length === 0) {
        toast.error(t('Failed to generate encryption key'))
      } else {
        messages.forEach((message) => {
          toast.error(`${t('Failed to generate encryption key')}: ${message}`)
        })
      }
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground text-sm">{t('Checking encryption key...')}</p>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-sm font-medium">{t('Encryption key synced!')}</p>
      </div>
    )
  }

  return (
    <div className="flex justify-center px-4 py-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <Smartphone className="text-muted-foreground h-16 w-16" />

        <div className="space-y-2 text-center">
          <h3 className="text-lg font-semibold">{t('Sync Encryption Key')}</h3>
          <p className="text-muted-foreground text-sm">
            {t(
              'An encryption key was found for your account. Please open a client that already has your DM encryption key set up to approve the sync request.'
            )}
          </p>
        </div>

        {(state === 'publishing' || state === 'waiting') && verificationCode && (
          <div className="bg-muted flex w-full flex-col items-center gap-2 rounded-lg p-4">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('Pairing code')}
            </span>
            <div className="font-mono text-2xl font-semibold tracking-[0.2em]">
              {verificationCode}
            </div>
            <p className="text-muted-foreground text-center text-xs">
              {t('Make sure this code matches the one shown on your other device.')}
            </p>
          </div>
        )}

        {state === 'publishing' && (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('Publishing sync request...')}</span>
          </div>
        )}

        {state === 'waiting' && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('Waiting for key from another device...')}</span>
            </div>
            <Button variant="outline" size="sm" disabled={countdown > 0} onClick={handleRetry}>
              <RefreshCw className="me-1.5 h-3.5 w-3.5" />
              {countdown > 0 ? t('Retry ({{seconds}}s)', { seconds: countdown }) : t('Retry')}
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-destructive text-center text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="me-1.5 h-3.5 w-3.5" />
              {t('Retry')}
            </Button>
          </div>
        )}

        <div className="w-full space-y-3 border-t pt-6">
          <p className="text-muted-foreground text-sm">
            {t(
              "Don't have access to another device? You can reset your encryption key to generate a new one. Messages encrypted with the old key can no longer be decrypted, but the chat history already saved on this device will not be lost."
            )}
          </p>
          <ResetEncryptionKeyButton onConfirm={handleGenerateNew} className="w-full" />
        </div>

        <div className="w-full space-y-3 border-t pt-6">
          <p className="text-muted-foreground text-sm">
            {t(
              'If the key never arrives, or resetting fails, your DM relays may be unreachable. Try editing them.'
            )}
          </p>
          {showRelayConfig ? (
            <div className="rounded-lg border">
              <DmRelayConfig onComplete={handleRelaysUpdated} />
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowRelayConfig(true)}>
              <Server className="me-1.5 h-3.5 w-3.5" />
              {t('Edit DM relays')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
