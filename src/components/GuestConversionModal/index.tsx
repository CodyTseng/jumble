import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import guestEngagementService from '@/services/guest-engagement.service'
import { AlertTriangle, Copy, Download, Sparkles, Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import AccountManager from '../AccountManager'

export default function GuestConversionModal({
  open,
  onClose,
  mode = 'initial'
}: {
  open: boolean
  onClose: () => void
  mode?: 'initial' | 'post-profile-save'
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { nsec } = useNostr()
  const { push } = useSecondaryPage()
  const [showAccountManager, setShowAccountManager] = useState(false)

  const handleCreateAccount = () => {
    onClose()
    push('/profile-editor')
  }

  const handleCopyKey = () => {
    if (!nsec) {
      toast.error(t('Could not retrieve account key'))
      return
    }

    navigator.clipboard.writeText(nsec)
    toast.success(t('Account key copied to clipboard!'))
  }

  const handleDownloadKey = () => {
    if (!nsec) {
      toast.error(t('Could not retrieve account key'))
      return
    }

    // Download the nsec as a text file
    const blob = new Blob([nsec], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'seewaan-account-key.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(t('Account key downloaded! Keep it safe.'))
  }

  const handleSaveGuestAccount = () => {
    handleDownloadKey()
    handleDismiss()
  }

  const handleImportAccount = () => {
    setShowAccountManager(true)
  }

  const handleDismiss = () => {
    guestEngagementService.markModalDismissed()
    onClose()
  }

  const content = showAccountManager ? (
    <AccountManager close={onClose} />
  ) : mode === 'post-profile-save' ? (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        </div>
        <DialogTitle className="text-2xl font-bold">{t('Account Created!')}</DialogTitle>
        <p className="text-muted-foreground">
          {t("Save your account key now. You'll need it to access your account from other devices.")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700 dark:text-yellow-200">
            {t(
              'If you lose this key, you will permanently lose access to your account. Save it in a secure location like a password manager.'
            )}
          </div>
        </div>

        <div className="bg-muted p-3 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">{t('Your Account Key:')}</p>
          <code className="text-xs break-all font-mono block bg-background p-2 rounded">
            {nsec}
          </code>
        </div>

        <Button onClick={handleCopyKey} size="lg" className="w-full">
          <Copy className="w-4 h-4 mr-2" />
          {t('Copy Key')}
        </Button>

        <Button onClick={handleDownloadKey} variant="outline" size="lg" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          {t('Download Key')}
        </Button>
      </div>

      <div className="text-center">
        <Button onClick={onClose} variant="ghost" size="sm">
          {t('I saved it, continue')}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        </div>
        <DialogTitle className="text-2xl font-bold">
          {t("You're on a roll!")}
        </DialogTitle>
        <p className="text-muted-foreground">
          {t(
            "You've made 7 interactions on Seewaan. Ready to make this your permanent account?"
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleCreateAccount} size="lg" className="w-full">
          <Sparkles className="w-4 h-4 mr-2" />
          {t('Make This My Permanent Account')}
        </Button>

        <Button onClick={handleSaveGuestAccount} variant="outline" size="lg" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          {t('Save Guest Account Key')}
        </Button>

        <Button onClick={handleImportAccount} variant="outline" size="lg" className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          {t('Import Existing Account')}
        </Button>
      </div>

      <div className="text-center">
        <Button onClick={handleDismiss} variant="ghost" size="sm">
          {t('Maybe later')}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground text-center bg-muted p-3 rounded-lg">
        {t(
          'Your guest account is temporary. Save the key or create a permanent account to keep your identity and content.'
        )}
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh]">
          {!showAccountManager && (
            <DrawerHeader>
              <DrawerTitle>{t("You're on a roll!")}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="flex flex-col p-4 gap-4 overflow-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[520px] max-h-[90vh] py-8 overflow-auto">
        {!showAccountManager && (
          <DialogHeader>
            <DialogTitle className="sr-only">{t('Account Conversion')}</DialogTitle>
          </DialogHeader>
        )}
        {content}
      </DialogContent>
    </Dialog>
  )
}
