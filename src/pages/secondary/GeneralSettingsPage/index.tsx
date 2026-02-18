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
import { isSupportCheckConnectionType } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TMediaAutoLoadPolicy, TNsfwDisplayPolicy, TProfilePictureAutoLoadPolicy } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { RotateCcw } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DefaultTrustScoreFilter from './DefaultTrustScoreFilter'
import MutedWords from './MutedWords'
import SettingItem from './SettingItem'

const GeneralSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const {
    autoplay,
    setAutoplay,
    videoLoop,
    setVideoLoop,
    nsfwDisplayPolicy,
    setNsfwDisplayPolicy,
    hideContentMentioningMutedUsers,
    setHideContentMentioningMutedUsers,
    mediaAutoLoadPolicy,
    setMediaAutoLoadPolicy,
    profilePictureAutoLoadPolicy,
    setProfilePictureAutoLoadPolicy
  } = useContentPolicy()
  const { quickReaction, updateQuickReaction, quickReactionEmoji, updateQuickReactionEmoji } =
    useUserPreferences()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('General')}>
      <div className="mt-3 space-y-4">
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
          <Label htmlFor="video-loop" className="text-base font-normal">
            <div>{t('Video loop')}</div>
            <div className="text-muted-foreground">
              {t('Automatically replay videos when they end')}
            </div>
          </Label>
          <Switch id="video-loop" checked={videoLoop} onCheckedChange={setVideoLoop} />
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
        <DefaultTrustScoreFilter />
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
        <MutedWords />
      </div>
    </SecondaryPageLayout>
  )
})
GeneralSettingsPage.displayName = 'GeneralSettingsPage'
export default GeneralSettingsPage
