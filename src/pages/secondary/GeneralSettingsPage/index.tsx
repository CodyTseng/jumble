import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MEDIA_AUTO_LOAD_POLICY, NOTIFICATION_LIST_STYLE } from '@/constants'
import { LocalizedLanguageNames, TLanguage } from '@/i18n'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn, isSupportCheckConnectionType } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { TMediaAutoLoadPolicy } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { ExternalLink } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GeneralSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const {
    autoplay,
    setAutoplay,
    defaultShowNsfw,
    setDefaultShowNsfw,
    hideContentMentioningMutedUsers,
    setHideContentMentioningMutedUsers,
    mediaAutoLoadPolicy,
    setMediaAutoLoadPolicy
  } = useContentPolicy()
  const { hideUntrustedNotes, updateHideUntrustedNotes } = useUserTrust()
  const { notificationListStyle, updateNotificationListStyle } = useUserPreferences()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('General')}>
      <div className="space-y-4 mt-3">
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
        <SettingItem>
          <Label htmlFor="notification-list-style" className="text-base font-normal">
            <div>{t('Notification list style')}</div>
            <div className="text-muted-foreground">
              {notificationListStyle === NOTIFICATION_LIST_STYLE.DETAILED
                ? t('See extra info for each notification')
                : t('See more notifications at a glance')}
            </div>
          </Label>
          <Select
            defaultValue={NOTIFICATION_LIST_STYLE.DETAILED}
            value={notificationListStyle}
            onValueChange={updateNotificationListStyle}
          >
            <SelectTrigger id="notification-list-style" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOTIFICATION_LIST_STYLE.DETAILED}>{t('Detailed')}</SelectItem>
              <SelectItem value={NOTIFICATION_LIST_STYLE.COMPACT}>{t('Compact')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingItem>
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
          <Label htmlFor="show-nsfw" className="text-base font-normal">
            {t('Show NSFW content by default')}
          </Label>
          <Switch id="show-nsfw" checked={defaultShowNsfw} onCheckedChange={setDefaultShowNsfw} />
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
