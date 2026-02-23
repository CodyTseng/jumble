import DmList from '@/components/DmList'
import DmRelayConfig from '@/components/DmRelayConfig'
import NewDeviceKeySync from '@/components/NewDeviceKeySync'
import ResetEncryptionKeyButton from '@/components/ResetEncryptionKeyButton'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { usePrimaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import encryptionKeyService from '@/services/encryption-key.service'
import indexedDb from '@/services/indexed-db.service'
import { TPageRef } from '@/types'
import { Event } from 'nostr-tools'
import { Key, Loader2, MessageSquare, Settings, Download, Upload } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
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
    setShowRelayConfig(false)

    if (!pubkey) {
      setSetupState('need_login')
      return
    }

    // Fast path: if local encryption key exists, setup was already completed.
    // Skip the network fetch which may return stale cached null from IndexedDB.
    const localKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
    if (localKeypair) {
      setSetupState('ready')
      // Background check for key mismatch (e.g. key rotated on another device)
      dmService.checkDmSupport(pubkey).then(({ encryptionPubkey }) => {
        if (encryptionPubkey && encryptionPubkey !== localKeypair.pubkey) {
          console.log('[DM setup] key mismatch detected, entering sync flow')
          encryptionKeyService.removeEncryptionKey(pubkey)
          dmService.resetEncryption()
          setSetupState('need_sync')
        }
      }).catch(() => {})
      return
    }

    setSetupState('loading')

    try {
      const { hasDmRelays, hasEncryptionKey } =
        await dmService.checkDmSupport(pubkey)
      if (!hasDmRelays) {
        setSetupState('need_relays')
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

  useEffect(() => {
    if (!pubkey) return

    const unsub = dmService.onEncryptionKeyChanged(() => {
      encryptionKeyService.removeEncryptionKey(pubkey)
      dmService.resetEncryption()
      setSetupState('need_sync')
    })

    return unsub
  }, [pubkey])

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
        dmService.resetEncryption()
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
        dmService.resetEncryption()
        dmService.init(pubkey, encryptionKeypair)
      }
    }
  }

  const handleResetEncryptionKey = async () => {
    if (!pubkey) return

    try {
      encryptionKeyService.removeEncryptionKey(pubkey)
      dmService.resetEncryption()
      encryptionKeyService.generateEncryptionKey(pubkey)
      const signer = {
        getPublicKey: async () => pubkey,
        signEvent
      }
      await encryptionKeyService.publishEncryptionKeyAnnouncement(signer as any, pubkey)
      toast.success(t('Encryption key has been reset'))
      const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
      if (encryptionKeypair) {
        dmService.init(pubkey, encryptionKeypair)
      }
    } catch (error) {
      console.error('Failed to reset encryption key:', error)
      toast.error(t('Failed to reset encryption key'))
    }
  }

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="dms"
      titlebar={
        <DmPageTitlebar
          showSettings={setupState === 'ready'}
          isSettingsActive={showRelayConfig}
          onSettingsClick={() => setShowRelayConfig((prev) => !prev)}
        />
      }
    >
      {setupState === 'loading' && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {setupState === 'need_login' && <NeedLoginView />}
      {setupState === 'need_relays' && <DmRelayConfig onComplete={handleRelayConfigComplete} />}
      {setupState === 'need_encryption_key' && (
        <NeedEncryptionKeyView onPublish={handlePublishEncryptionKey} />
      )}
      {setupState === 'need_sync' && (
        <NewDeviceKeySync onComplete={handleKeySyncComplete} />
      )}
      {setupState === 'ready' && (
        <>
          {showRelayConfig && (
            <>
              <DmRelayConfig />
              <ChatHistorySection accountPubkey={pubkey!} />
              <ResetEncryptionKeySection onReset={handleResetEncryptionKey} />
            </>
          )}
          <DmList />
        </>
      )}
    </PrimaryPageLayout>
  )
})
DmPage.displayName = 'DmPage'
export default DmPage

function DmPageTitlebar({
  showSettings,
  isSettingsActive,
  onSettingsClick
}: {
  showSettings: boolean
  isSettingsActive: boolean
  onSettingsClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between h-full pl-3">
      <div className="flex items-center gap-2">
        <MessageSquare />
        <div className="text-lg font-semibold">{t('Messages')}</div>
      </div>
      {showSettings && (
        <Button
          variant="ghost"
          size="titlebar-icon"
          onClick={onSettingsClick}
          className={isSettingsActive ? 'bg-muted/40' : ''}
        >
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

function ChatHistorySection({ accountPubkey }: { accountPubkey: string }) {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const messages = await indexedDb.getAllDmMessagesForAccount(accountPubkey)
      if (messages.length === 0) {
        toast.info(t('No messages to export'))
        return
      }

      const lines = messages.map((msg) => JSON.stringify(msg.decryptedRumor))
      const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' })

      const date = new Date().toISOString().slice(0, 10)
      const filename = `jumble-dm-${date}.jsonl`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      toast.success(t('Exported {{count}} messages', { count: messages.length }))
    } catch (error) {
      console.error('Failed to export chat history:', error)
      toast.error(t('Failed to export chat history'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((line) => line.trim())
      const rumors: Event[] = []
      const errors: number[] = []

      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed = JSON.parse(lines[i])
          if (parsed.kind !== 14 && parsed.kind !== 15) {
            errors.push(i + 1)
            continue
          }
          if (!parsed.id || !parsed.pubkey || !parsed.created_at || !parsed.tags || parsed.content === undefined) {
            errors.push(i + 1)
            continue
          }
          rumors.push(parsed as Event)
        } catch {
          errors.push(i + 1)
        }
      }

      if (rumors.length === 0) {
        toast.error(t('No valid messages found in file'))
        return
      }

      const count = await dmService.importMessages(accountPubkey, rumors)

      if (errors.length > 0) {
        toast.warning(
          t('Imported {{count}} messages, {{errors}} lines skipped', {
            count,
            errors: errors.length
          })
        )
      } else {
        toast.success(t('Imported {{count}} messages', { count }))
      }
    } catch (error) {
      console.error('Failed to import chat history:', error)
      toast.error(t('Failed to import chat history'))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-2 border-t px-4 py-4">
      <div className="text-sm font-medium">{t('Chat History')}</div>
      <p className="text-sm text-muted-foreground">
        {t(
          'Export your chat history as a backup file, or import a previously exported file to restore messages.'
        )}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {t('Export')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {t('Import')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl"
          className="hidden"
          onChange={handleImport}
        />
      </div>
    </div>
  )
}

function ResetEncryptionKeySection({ onReset }: { onReset: () => Promise<void> }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2 border-t px-4 py-4">
      <div className="text-sm font-medium">{t('Encryption Key')}</div>
      <p className="text-sm text-muted-foreground">
        {t(
          'Your encryption key is used to encrypt and decrypt direct messages. It is separate from your Nostr private key and is specific to this messaging feature.'
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(
          'Resetting will generate a new key. You will no longer be able to read old messages. Please export and backup your chat history before proceeding.'
        )}
      </p>
      <ResetEncryptionKeyButton onConfirm={onReset} />
    </div>
  )
}

