import AboutInfoDialog from '@/components/AboutInfoDialog'
import Donation from '@/components/Donation'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  toAppearanceSettings,
  toGeneralSettings,
  toPostSettings,
  toRelaySettings,
  toTranslation,
  toWallet
} from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import {
  Check,
  ChevronRight,
  Copy,
  Info,
  KeyRound,
  Languages,
  Palette,
  PencilLine,
  Server,
  Settings2,
  Wallet
} from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey, nsec, ncryptsec } = useNostr()
  const { push } = useSecondaryPage()
  const [copiedNsec, setCopiedNsec] = useState(false)
  const [copiedNcryptsec, setCopiedNcryptsec] = useState(false)

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Settings')}>
      <SettingItem className="clickable" onClick={() => push(toGeneralSettings())}>
        <div className="flex items-center gap-4">
          <Settings2 />
          <div>{t('General')}</div>
        </div>
        <ChevronRight />
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toAppearanceSettings())}>
        <div className="flex items-center gap-4">
          <Palette />
          <div>{t('Appearance')}</div>
        </div>
        <ChevronRight />
      </SettingItem>
      <SettingItem className="clickable" onClick={() => push(toRelaySettings())}>
        <div className="flex items-center gap-4">
          <Server />
          <div>{t('Relays')}</div>
        </div>
        <ChevronRight />
      </SettingItem>
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toTranslation())}>
          <div className="flex items-center gap-4">
            <Languages />
            <div>{t('Translation')}</div>
          </div>
          <ChevronRight />
        </SettingItem>
      )}
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toWallet())}>
          <div className="flex items-center gap-4">
            <Wallet />
            <div>{t('Wallet')}</div>
          </div>
          <ChevronRight />
        </SettingItem>
      )}
      {!!pubkey && (
        <SettingItem className="clickable" onClick={() => push(toPostSettings())}>
          <div className="flex items-center gap-4">
            <PencilLine />
            <div>{t('Post settings')}</div>
          </div>
          <ChevronRight />
        </SettingItem>
      )}
      {!!nsec && (
        <SettingItem
          className="clickable"
          onClick={() => {
            navigator.clipboard.writeText(nsec)
            setCopiedNsec(true)
            setTimeout(() => setCopiedNsec(false), 2000)
          }}
        >
          <div className="flex items-center gap-4">
            <KeyRound />
            <div>{t('Copy private key')} (nsec)</div>
          </div>
          {copiedNsec ? <Check /> : <Copy />}
        </SettingItem>
      )}
      {!!ncryptsec && (
        <SettingItem
          className="clickable"
          onClick={() => {
            navigator.clipboard.writeText(ncryptsec)
            setCopiedNcryptsec(true)
            setTimeout(() => setCopiedNcryptsec(false), 2000)
          }}
        >
          <div className="flex items-center gap-4">
            <KeyRound />
            <div>{t('Copy private key')} (ncryptsec)</div>
          </div>
          {copiedNcryptsec ? <Check /> : <Copy />}
        </SettingItem>
      )}
      <AboutInfoDialog>
        <SettingItem className="clickable">
          <div className="flex items-center gap-4">
            <Info />
            <div>{t('About')}</div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="text-muted-foreground">
              v{import.meta.env.APP_VERSION} ({import.meta.env.GIT_COMMIT})
            </div>
            <ChevronRight />
          </div>
        </SettingItem>
      </AboutInfoDialog>
      <div className="px-4 mt-4">
        <Donation />
      </div>
    </SecondaryPageLayout>
  )
})
SettingsPage.displayName = 'SettingsPage'
export default SettingsPage

const SettingItem = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex justify-between select-none items-center px-4 py-2 h-[52px] rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
          className
        )}
        {...props}
        ref={ref}
      >
        {children}
      </div>
    )
  }
)
SettingItem.displayName = 'SettingItem'
