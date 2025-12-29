import Emoji from '@/components/Emoji'
import EmojiPickerDialog from '@/components/EmojiPickerDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  MEDIA_AUTO_LOAD_POLICY,
  NSFW_DISPLAY_POLICY,
  PROFILE_PICTURE_AUTO_LOAD_POLICY
} from '@/constants'
import { LocalizedLanguageNames, TLanguage } from '@/i18n'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn, isSupportCheckConnectionType } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { TMediaAutoLoadPolicy, TProfilePictureAutoLoadPolicy, TNsfwDisplayPolicy } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { RotateCcw } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GeneralSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const {
    autoplay,
    setAutoplay,
    nsfwDisplayPolicy,
    setNsfwDisplayPolicy,
    hideContentMentioningMutedUsers,
    setHideContentMentioningMutedUsers,
    mediaAutoLoadPolicy,
    setMediaAutoLoadPolicy,
    profilePictureAutoLoadPolicy,
    setProfilePictureAutoLoadPolicy
  } = useContentPolicy()
  const { hideUntrustedNotes, updateHideUntrustedNotes } = useUserTrust()
  const { quickReaction, updateQuickReaction, quickReactionEmoji, updateQuickReactionEmoji } =
    useUserPreferences()

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
          <Label htmlFor="profile-picture-auto-load-policy" className="text-base font-normal">
            {t('Auto-load profile pictures')}
          </Label>
          <Select
            defaultValue="always"
            value={profilePictureAutoLoadPolicy}
            onValueChange={(value: TProfilePictureAutoLoadPolicy) =>
              setProfilePictureAutoLoadPolicy(value as TProfilePictureAutoLoadPolicy)
            }
          >
            <SelectTrigger id="profile-picture-auto-load-policy" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROFILE_PICTURE_AUTO_LOAD_POLICY.ALWAYS}>{t('Always')}</SelectItem>
              {isSupportCheckConnectionType() && (
                <SelectItem value={PROFILE_PICTURE_AUTO_LOAD_POLICY.WIFI_ONLY}>
                  {t('Wi-Fi only')}
                </SelectItem>
              )}
              <SelectItem value={PROFILE_PICTURE_AUTO_LOAD_POLICY.NEVER}>{t('Never')}</SelectItem>
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
          <Label htmlFor="nsfw-display-policy" className="text-base font-normal">
            {t('NSFW content display')}
          </Label>
          <Select
            value={nsfwDisplayPolicy}
            onValueChange={(value: TNsfwDisplayPolicy) => setNsfwDisplayPolicy(value)}
          >
            <SelectTrigger id="nsfw-display-policy" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NSFW_DISPLAY_POLICY.HIDE}>{t('Hide completely')}</SelectItem>
              <SelectItem value={NSFW_DISPLAY_POLICY.HIDE_CONTENT}>
                {t('Show but hide content')}
              </SelectItem>
              <SelectItem value={NSFW_DISPLAY_POLICY.SHOW}>{t('Show directly')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingItem>
        <SettingItem>
          <Label htmlFor="quick-reaction" className="text-base font-normal">
            <div>{t('Quick reaction')}</div>
            <div className="text-muted-foreground">
              {t('If enabled, you can react with a single click. Click and hold for more options')}
            </div>
          </Label>
          <Switch
            id="quick-reaction"
            checked={quickReaction}
            onCheckedChange={updateQuickReaction}
          />
        </SettingItem>
        {quickReaction && (
          <SettingItem>
            <Label htmlFor="quick-reaction-emoji" className="text-base font-normal">
              {t('Quick reaction emoji')}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateQuickReactionEmoji('+')}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw />
              </Button>
              <EmojiPickerDialog
                onEmojiClick={(emoji) => {
                  if (!emoji) return
                  updateQuickReactionEmoji(emoji)
                }}
              >
                <Button variant="ghost" size="icon" className="border">
                  <Emoji emoji={quickReactionEmoji} />
                </Button>
              </EmojiPickerDialog>
            </div>
          </SettingItem>
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
