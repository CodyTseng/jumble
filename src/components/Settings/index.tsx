import AboutInfoDialog from '@/components/AboutInfoDialog'
import Donation from '@/components/Donation'
import DownloadDialog from '@/components/DownloadDialog'
import {
  SettingsGroup,
  SettingsPageContainer,
  SettingsRow
} from '@/components/ui/settings'
import {
  toAccountSettings,
  toAppearanceSettings,
  toContactNotesSettings,
  toEmojiPackSettings,
  toGeneralSettings,
  toPostSettings,
  toRelaySettings,
  toSystemSettings,
  toTranslation,
  toWallet
} from '@/lib/link'
import { isElectron } from '@/lib/platform'
import { isPomegranateAccount } from '@/lib/pomegranate'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import storage from '@/services/local-storage.service'
import {
  Cog,
  Info,
  KeyRound,
  Languages,
  MonitorDown,
  Palette,
  PencilLine,
  NotebookPen,
  Server,
  Settings2,
  Smile,
  Wallet
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { t } = useTranslation()
  const { pubkey, nsec, ncryptsec, account } = useNostr()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const hasPrivateKey = !!nsec || !!ncryptsec
  const fullAccount = account ? storage.findAccount(account) : undefined
  const isPomegranate = !!fullAccount && isPomegranateAccount(fullAccount)
  const showDownloadEntry = !isElectron() && !isSmallScreen
  const [downloadOpen, setDownloadOpen] = useState(false)

  return (
    <SettingsPageContainer>
      <SettingsGroup title={t('Preferences')}>
        <SettingsRow
          icon={<Settings2 />}
          title={t('General')}
          chevron
          onClick={() => push(toGeneralSettings())}
        />
        <SettingsRow
          icon={<Palette />}
          title={t('Appearance')}
          chevron
          onClick={() => push(toAppearanceSettings())}
        />
        {!!pubkey && (
          <SettingsRow
            icon={<Languages />}
            title={t('Translation')}
            chevron
            onClick={() => push(toTranslation())}
          />
        )}
        {!!pubkey && (
          <SettingsRow
            icon={<PencilLine />}
            title={t('Post settings')}
            chevron
            onClick={() => push(toPostSettings())}
          />
        )}
        {!!pubkey && (
          <SettingsRow
            icon={<Smile />}
            title={t('Emoji Packs')}
            chevron
            onClick={() => push(toEmojiPackSettings())}
          />
        )}
        {!!pubkey && (
          <SettingsRow
            icon={<NotebookPen />}
            title={t('Private contact notes')}
            chevron
            onClick={() => push(toContactNotesSettings())}
          />
        )}
      </SettingsGroup>

      {(!!pubkey || hasPrivateKey) && (
        <SettingsGroup title={t('Account')}>
          {!!pubkey && (
            <SettingsRow
              icon={<Wallet />}
              title={t('Wallet')}
              chevron
              onClick={() => push(toWallet())}
            />
          )}
          {(hasPrivateKey || isPomegranate) && (
            <SettingsRow
              icon={<KeyRound />}
              title={t('Account')}
              chevron
              onClick={() => push(toAccountSettings())}
            />
          )}
        </SettingsGroup>
      )}

      <SettingsGroup title={t('Network & system')}>
        <SettingsRow
          icon={<Server />}
          title={t('Relays')}
          chevron
          onClick={() => push(toRelaySettings())}
        />
        <SettingsRow
          icon={<Cog />}
          title={t('System')}
          chevron
          onClick={() => push(toSystemSettings())}
        />
      </SettingsGroup>

      {showDownloadEntry && (
        <SettingsGroup>
          <SettingsRow
            icon={<MonitorDown />}
            title={t('Download Jumble Desktop')}
            chevron
            onClick={() => setDownloadOpen(true)}
          />
        </SettingsGroup>
      )}

      <SettingsGroup>
        <AboutInfoDialog>
          <SettingsRow
            icon={<Info />}
            title={t('About')}
            trailing={`v${import.meta.env.APP_VERSION} (${import.meta.env.GIT_COMMIT})`}
            chevron
            clickable
          />
        </AboutInfoDialog>
      </SettingsGroup>

      <div className="pt-6">
        <Donation />
      </div>

      {showDownloadEntry && (
        <DownloadDialog open={downloadOpen} onOpenChange={setDownloadOpen} />
      )}
    </SettingsPageContainer>
  )
}
