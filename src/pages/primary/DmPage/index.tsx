import DmList from '@/components/DmList'
import DmRelayConfig from '@/components/DmRelayConfig'
import NewDeviceKeySync from '@/components/NewDeviceKeySync'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { TPageRef } from '@/types'
import { Key, Loader2, MessageSquare, Settings } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type TSetupState =
  | 'loading'
  | 'need_login'
  | 'need_relays'
  | 'need_encryption_key'
  | 'need_sync'
  | 'ready'

const DmPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { pubkey, signEvent } = useNostr()
  const { current } = usePrimaryPage()
  const [setupState, setSetupState] = useState<TSetupState>('loading')
  const [showRelayConfig, setShowRelayConfig] = useState(false)

  const checkSetup = useCallback(async () => {
    if (!pubkey) {
      setSetupState('need_login')
      return
    }

    setSetupState('loading')

    try {
      const { hasDmRelays, hasEncryptionKey, encryptionPubkey } =
        await dmService.checkDmSupport(pubkey)
      if (!hasDmRelays) {
        setSetupState('need_relays')
        return
      }

      const localKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
      if (localKeypair) {
        console.log('[DM setup] local encryptionPubkey:', localKeypair.pubkey)
        console.log('[DM setup] remote encryptionPubkey:', encryptionPubkey)
        if (encryptionPubkey && encryptionPubkey !== localKeypair.pubkey) {
          console.log('[DM setup] key mismatch, entering sync flow')
          encryptionKeyService.removeEncryptionKey(pubkey)
          dmService.destroy()
          setSetupState('need_sync')
          return
        }
        setSetupState('ready')
        return
      }

      if (hasEncryptionKey) {
        setSetupState('need_sync')
        return
      }

      // Has relays but no encryption key - ask user if they want to publish one
      setSetupState('need_encryption_key')
    } catch (error) {
      console.error('Failed to check DM setup:', error)
      setSetupState('need_relays')
    }
  }, [pubkey])

  useEffect(() => {
    if (current === 'dms') {
      checkSetup()
    }
  }, [current, pubkey, checkSetup])

  const handleRelayConfigComplete = async () => {
    if (!pubkey) return

    const hasLocalKey = encryptionKeyService.hasEncryptionKey(pubkey)
    if (hasLocalKey) {
      setSetupState('ready')
      setShowRelayConfig(false)
      return
    }

    const existingAnnouncement = await encryptionKeyService.queryEncryptionKeyAnnouncement(pubkey)
    if (existingAnnouncement) {
      setSetupState('need_sync')
    } else {
      // Ask user if they want to publish encryption key
      setSetupState('need_encryption_key')
    }
    setShowRelayConfig(false)
  }

  const handlePublishEncryptionKey = async () => {
    if (!pubkey) return

    try {
      encryptionKeyService.generateEncryptionKey(pubkey)
      const signer = {
        getPublicKey: async () => pubkey,
        signEvent
      }
      await encryptionKeyService.publishEncryptionKeyAnnouncement(signer as any, pubkey)
      toast.success(t('Encryption key published'))
      setSetupState('ready')
      const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
      if (encryptionKeypair) {
        dmService.init(pubkey, encryptionKeypair)
      }
    } catch (error) {
      console.error('Failed to publish encryption key:', error)
      toast.error(t('Failed to publish encryption key'))
    }
  }

  const handleKeySyncComplete = () => {
    setSetupState('ready')
    if (pubkey) {
      const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
      if (encryptionKeypair) {
        dmService.init(pubkey, encryptionKeypair)
      }
    }
  }

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="dms"
      titlebar={
        <DmPageTitlebar
          showSettings={setupState === 'ready'}
          onSettingsClick={() => setShowRelayConfig(true)}
        />
      }
    >
      {setupState === 'loading' && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {setupState === 'need_login' && <NeedLoginView />}
      {(setupState === 'need_relays' || showRelayConfig) && (
        <DmRelayConfig onComplete={handleRelayConfigComplete} />
      )}
      {setupState === 'need_encryption_key' && !showRelayConfig && (
        <NeedEncryptionKeyView onPublish={handlePublishEncryptionKey} />
      )}
      {setupState === 'need_sync' && !showRelayConfig && (
        <NewDeviceKeySync onComplete={handleKeySyncComplete} />
      )}
      {setupState === 'ready' && !showRelayConfig && <DmList />}
    </PrimaryPageLayout>
  )
})
DmPage.displayName = 'DmPage'
export default DmPage

function DmPageTitlebar({
  showSettings,
  onSettingsClick
}: {
  showSettings: boolean
  onSettingsClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center justify-between h-full pl-3 pr-1">
      <div className="flex items-center gap-2">
        <MessageSquare />
        <div className="text-lg font-semibold">{t('Messages')}</div>
      </div>
      {showSettings && (
        <Button variant="ghost" size="titlebar-icon" onClick={onSettingsClick}>
          <Settings className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}

function NeedLoginView() {
  const { t } = useTranslation()
  const { startLogin } = useNostr()

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
      <MessageSquare className="h-16 w-16 text-muted-foreground" />
      <div className="space-y-2">
        <h3 className="font-medium">{t('Sign in to use Messages')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('You need to be signed in to send and receive direct messages.')}
        </p>
      </div>
      <Button onClick={startLogin}>{t('Sign In')}</Button>
    </div>
  )
}

function NeedEncryptionKeyView({ onPublish }: { onPublish: () => void }) {
  const { t } = useTranslation()
  const [isPublishing, setIsPublishing] = useState(false)

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      await onPublish()
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
      <Key className="h-16 w-16 text-muted-foreground" />
      <div className="space-y-2">
        <h3 className="font-medium">{t('Enable Direct Messages')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t(
            'To receive direct messages, you need to publish an encryption key. This allows others to send you encrypted messages.'
          )}
        </p>
      </div>
      <Button onClick={handlePublish} disabled={isPublishing}>
        {isPublishing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t('Publishing...')}
          </>
        ) : (
          t('Publish Encryption Key')
        )}
      </Button>
    </div>
  )
}

