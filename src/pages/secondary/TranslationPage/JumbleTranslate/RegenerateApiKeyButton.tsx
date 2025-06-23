import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Loader, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useJumbleTranslateAccount } from './JumbleTranslateAccountProvider'

export default function RegenerateApiKeyButton() {
  const { t } = useTranslation()
  const { account, regenerateApiKey } = useJumbleTranslateAccount()
  const [resettingApiKey, setResettingApiKey] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  const handleRegenerateApiKey = async () => {
    if (resettingApiKey || !account) return

    setResettingApiKey(true)
    await regenerateApiKey()
    setShowResetDialog(false)
    setResettingApiKey(false)
  }

  return (
    <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!account?.api_key}>
          <RotateCcw />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Reset API key')}</DialogTitle>
          <DialogDescription>
            {t('Are you sure you want to reset your API key? This action cannot be undone.')}
            <br />
            <br />
            <strong>{t('Warning')}:</strong>{' '}
            {t(
              'Your current API key will become invalid immediately, and any applications using it will stop working until you update them with the new key.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(false)}
            disabled={resettingApiKey}
          >
            {t('Cancel')}
          </Button>
          <Button variant="destructive" onClick={handleRegenerateApiKey} disabled={resettingApiKey}>
            {resettingApiKey && <Loader className="animate-spin" />}
            {t('Reset API key')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
