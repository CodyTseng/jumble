import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import Tabs from '@/components/Tabs'
import { DISTRACTION_FREE_MODE, MEDIA_AUTO_LOAD_POLICY } from '@/constants'
import { LocalizedLanguageNames, TLanguage } from '@/i18n'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn, isSupportCheckConnectionType } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDistractionFreeMode } from '@/providers/DistractionFreeModeProvider'
import { useReadsVisibility } from '@/providers/ReadsVisibilityProvider'
import { useListsVisibility } from '@/providers/ListsVisibilityProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useRTL } from '@/providers/RTLProvider'
import { TMediaAutoLoadPolicy } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { Check, ExternalLink, BellOff, BellRing } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GeneralSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState('interface')
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const {
    autoplay,
    setAutoplay,
    defaultShowNsfw,
    setDefaultShowNsfw,
    hideContentMentioningMutedUsers,
    setHideContentMentioningMutedUsers,
    alwaysHideMutedNotes,
    setAlwaysHideMutedNotes,
    hideNotificationsFromMutedUsers,
    setHideNotificationsFromMutedUsers,
    mediaAutoLoadPolicy,
    setMediaAutoLoadPolicy
  } = useContentPolicy()
  const { hideUntrustedNotes, updateHideUntrustedNotes } = useUserTrust()
  const { distractionFreeMode, setDistractionFreeMode } = useDistractionFreeMode()
  const {
    hideReadsInNavigation,
    setHideReadsInNavigation,
    hideReadsInProfiles,
    setHideReadsInProfiles
  } = useReadsVisibility()
  const { hideListsInNavigation, setHideListsInNavigation } = useListsVisibility()
  const { isRTL, toggleRTL, showRTLToggle } = useRTL()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  const tabDefinitions = [
    { value: 'interface', label: 'Interface' },
    { value: 'content', label: 'Content & Privacy' },
    { value: 'display', label: 'Display' }
  ]

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('General')}>
      <div className="mt-3">
        <Tabs
          tabs={tabDefinitions}
          value={activeTab}
          onTabChange={setActiveTab}
          threshold={0}
        />

        {/* INTERFACE TAB */}
        {activeTab === 'interface' && (
          <div className="space-y-4 mt-4">
            <SettingItem>
              <Label htmlFor="languages" className="text-base font-normal">
                {t('Languages')}
              </Label>
              <Select defaultValue="en" value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="languages" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LocalizedLanguageNames).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>
            {showRTLToggle && (
              <SettingItem>
                <Label htmlFor="rtl-mode" className="text-base font-normal">
                  {t('Right-to-left layout')}
                </Label>
                <Switch
                  id="rtl-mode"
                  checked={isRTL}
                  onCheckedChange={toggleRTL}
                />
              </SettingItem>
            )}
            <SettingItem className="flex-col items-start gap-3">
              <Label className="text-base font-normal">
                {t('Distraction-Free Mode')}
              </Label>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => setDistractionFreeMode(DISTRACTION_FREE_MODE.DRAIN_MY_TIME)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                    distractionFreeMode === DISTRACTION_FREE_MODE.DRAIN_MY_TIME
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Drain my time')}</span>
                  {distractionFreeMode === DISTRACTION_FREE_MODE.DRAIN_MY_TIME && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setDistractionFreeMode(DISTRACTION_FREE_MODE.FOCUS_MODE)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                    distractionFreeMode === DISTRACTION_FREE_MODE.FOCUS_MODE
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <BellOff className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Focus mode')}</span>
                  {distractionFreeMode === DISTRACTION_FREE_MODE.FOCUS_MODE && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
            </SettingItem>
            <SettingItem>
              <Label htmlFor="hide-reads-in-navigation" className="text-base font-normal">
                {t('Hide reads in navigation')}
              </Label>
              <Switch
                id="hide-reads-in-navigation"
                checked={hideReadsInNavigation}
                onCheckedChange={setHideReadsInNavigation}
              />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="hide-lists-in-navigation" className="text-base font-normal">
                {t('Hide lists in navigation')}
              </Label>
              <Switch
                id="hide-lists-in-navigation"
                checked={hideListsInNavigation}
                onCheckedChange={setHideListsInNavigation}
              />
            </SettingItem>
          </div>
        )}

        {/* CONTENT & PRIVACY TAB */}
        {activeTab === 'content' && (
          <div className="space-y-4 mt-4">
            <SettingItem>
              <Label htmlFor="media-auto-load-policy" className="text-base font-normal">
                {t('Auto-load media')}
              </Label>
              <Select
                defaultValue="wifi-only"
                value={mediaAutoLoadPolicy}
                onValueChange={(value: TMediaAutoLoadPolicy) =>
                  setMediaAutoLoadPolicy(value as TMediaAutoLoadPolicy)
                }
              >
                <SelectTrigger id="media-auto-load-policy" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MEDIA_AUTO_LOAD_POLICY.ALWAYS}>{t('Always')}</SelectItem>
                  {isSupportCheckConnectionType() && (
                    <SelectItem value={MEDIA_AUTO_LOAD_POLICY.WIFI_ONLY}>{t('Wi-Fi only')}</SelectItem>
                  )}
                  <SelectItem value={MEDIA_AUTO_LOAD_POLICY.NEVER}>{t('Never')}</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>
            <SettingItem>
              <Label htmlFor="autoplay" className="text-base font-normal">
                <div>{t('Autoplay')}</div>
                <div className="text-muted-foreground">{t('Enable video autoplay on this device')}</div>
              </Label>
              <Switch id="autoplay" checked={autoplay} onCheckedChange={setAutoplay} />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="show-nsfw" className="text-base font-normal">
                {t('Show NSFW content by default')}
              </Label>
              <Switch id="show-nsfw" checked={defaultShowNsfw} onCheckedChange={setDefaultShowNsfw} />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="hide-untrusted-notes" className="text-base font-normal">
                {t('Hide untrusted notes')}
              </Label>
              <Switch
                id="hide-untrusted-notes"
                checked={hideUntrustedNotes}
                onCheckedChange={updateHideUntrustedNotes}
              />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="hide-content-mentioning-muted-users" className="text-base font-normal">
                {t('Hide content mentioning muted users')}
              </Label>
              <Switch
                id="hide-content-mentioning-muted-users"
                checked={hideContentMentioningMutedUsers}
                onCheckedChange={setHideContentMentioningMutedUsers}
              />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="always-hide-muted-notes" className="text-base font-normal">
                <div>{t('Always hide muted notes')}</div>
                <div className="text-muted-foreground">{t('Completely hide notes from muted users, even in reposts')}</div>
              </Label>
              <Switch
                id="always-hide-muted-notes"
                checked={alwaysHideMutedNotes}
                onCheckedChange={setAlwaysHideMutedNotes}
              />
            </SettingItem>
            <SettingItem>
              <Label htmlFor="hide-notifications-from-muted-users" className="text-base font-normal">
                {t('Hide notifications from muted users')}
              </Label>
              <Switch
                id="hide-notifications-from-muted-users"
                checked={hideNotificationsFromMutedUsers}
                onCheckedChange={setHideNotificationsFromMutedUsers}
              />
            </SettingItem>
          </div>
        )}

        {/* DISPLAY TAB */}
        {activeTab === 'display' && (
          <div className="space-y-4 mt-4">
            <SettingItem>
              <Label htmlFor="hide-reads-in-profiles" className="text-base font-normal">
                {t('Hide reads in profiles')}
              </Label>
              <Switch
                id="hide-reads-in-profiles"
                checked={hideReadsInProfiles}
                onCheckedChange={setHideReadsInProfiles}
              />
            </SettingItem>
            <SettingItem>
              <div>
                <a
                  className="flex items-center gap-1 cursor-pointer hover:underline"
                  href="https://emojito.meme/browse"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Custom emoji management')}
                  <ExternalLink />
                </a>
                <div className="text-muted-foreground">
                  {t('After changing emojis, you may need to refresh the page')}
                </div>
              </div>
            </SettingItem>
          </div>
        )}
      </div>
    </SecondaryPageLayout>
  )
})
GeneralSettingsPage.displayName = 'GeneralSettingsPage'
export default GeneralSettingsPage

const SettingItem = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex justify-between select-none items-center px-4 min-h-9 [&_svg]:size-4 [&_svg]:shrink-0',
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
