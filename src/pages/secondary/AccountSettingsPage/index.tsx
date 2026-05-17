import PomegranateDisconnectDialog from '@/components/PomegranateDisconnectDialog'
import PomegranateExportDialog from '@/components/PomegranateExportDialog'
import { SettingsGroup, SettingsPageContainer, SettingsRow } from '@/components/ui/settings'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { isPomegranateAccount } from '@/lib/pomegranate'
import { useNostr } from '@/providers/NostrProvider'
import storage from '@/services/local-storage.service'
import { Check, Copy, KeyRound, Unplug } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const AccountSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { nsec, ncryptsec, account } = useNostr()
  const [copiedNsec, setCopiedNsec] = useState(false)
  const [copiedNcryptsec, setCopiedNcryptsec] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)

  const fullAccount = account ? storage.findAccount(account) : undefined
  const pomegranate = fullAccount ? isPomegranateAccount(fullAccount) : false

  const copy = async (value: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Account')}>
      <SettingsPageContainer>
        {(nsec || ncryptsec) && (
          <SettingsGroup
            title={t('Private key')}
            description={t(
              'Your private key controls your account. Keep it safe and never share it.'
            )}
          >
            {nsec && (
              <SettingsRow
                icon={<KeyRound />}
                title={`${t('Copy private key')} (nsec)`}
                onClick={() => copy(nsec, setCopiedNsec)}
                control={copiedNsec ? <Check className="size-4" /> : <Copy className="size-4" />}
              />
            )}
            {ncryptsec && (
              <SettingsRow
                icon={<KeyRound />}
                title={`${t('Copy private key')} (ncryptsec)`}
                onClick={() => copy(ncryptsec, setCopiedNcryptsec)}
                control={
                  copiedNcryptsec ? <Check className="size-4" /> : <Copy className="size-4" />
                }
              />
            )}
          </SettingsGroup>
        )}

        {pomegranate && account && fullAccount?.pomegranateCentral && (
          <>
            <SettingsGroup
              title={t('Private key')}
              description={t(
                'Your private key controls your account. Keep it safe and never share it.'
              )}
            >
              <SettingsRow
                icon={<KeyRound />}
                title={`${t('Export private key')} (nsec)`}
                chevron
                onClick={() => setExportDialogOpen(true)}
              />
            </SettingsGroup>
            <SettingsGroup
              title={t('Central server')}
              description={t(
                'Disconnecting unlinks this account from the central server. You can still use the account with your private key.'
              )}
            >
              <SettingsRow
                icon={<Unplug />}
                title={t('Disconnect from central server')}
                destructive
                chevron
                onClick={() => setDisconnectDialogOpen(true)}
              />
            </SettingsGroup>
            <PomegranateExportDialog
              open={exportDialogOpen}
              onOpenChange={setExportDialogOpen}
              central={fullAccount.pomegranateCentral}
              pubkey={fullAccount.pubkey}
            />
            <PomegranateDisconnectDialog
              open={disconnectDialogOpen}
              onOpenChange={setDisconnectDialogOpen}
              central={fullAccount.pomegranateCentral}
              account={account}
            />
          </>
        )}
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})
AccountSettingsPage.displayName = 'AccountSettingsPage'
export default AccountSettingsPage
