import Emoji from '@/components/Emoji'
import ExpressionPickerDialog from '@/components/ExpressionPickerDialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  SettingsGroup,
  SettingsPageContainer,
  SettingsRow
} from '@/components/ui/settings'
import { Switch } from '@/components/ui/switch'
import { MEDIA_AUTO_LOAD_POLICY, NSFW_DISPLAY_POLICY } from '@/constants'
import { LocalizedLanguageNames, TLanguage } from '@/i18n'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { isSupportCheckConnectionType } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import localStorage from '@/services/local-storage.service'
import { TMediaAutoLoadPolicy, TNsfwDisplayPolicy } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { RotateCcw } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DefaultTrustScoreFilter from './DefaultTrustScoreFilter'
import MutedWords from './MutedWords'

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
    setMediaAutoLoadPolicy
  } = useContentPolicy()
  const { quickReaction, updateQuickReaction, quickReactionEmoji, updateQuickReactionEmoji } =
    useUserPreferences()
  const [disableNotificationSync, setDisableNotificationSync] = useState(
    localStorage.getDisableNotificationSync()
  )

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('General')}>
      <SettingsPageContainer>
        <SettingsGroup title={t('Language')}>
          <SettingsRow
            htmlFor="languages"
            title={t('Languages')}
            control={
              <Select defaultValue="en" value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="languages" className="w-44">
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
            }
          />
        </SettingsGroup>

        <SettingsGroup title={t('Media')}>
          <SettingsRow
            htmlFor="media-auto-load-policy"
            title={t('Auto-load media')}
            control={
              <Select
                defaultValue="wifi-only"
                value={mediaAutoLoadPolicy}
                onValueChange={(value: TMediaAutoLoadPolicy) =>
                  setMediaAutoLoadPolicy(value as TMediaAutoLoadPolicy)
                }
              >
                <SelectTrigger id="media-auto-load-policy" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MEDIA_AUTO_LOAD_POLICY.ALWAYS}>{t('Always')}</SelectItem>
                  {isSupportCheckConnectionType() && (
                    <SelectItem value={MEDIA_AUTO_LOAD_POLICY.WIFI_ONLY}>
                      {t('Wi-Fi only')}
                    </SelectItem>
                  )}
                  <SelectItem value={MEDIA_AUTO_LOAD_POLICY.NEVER}>{t('Never')}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            htmlFor="autoplay"
            title={t('Autoplay')}
            description={t('Enable video autoplay on this device')}
            control={<Switch id="autoplay" checked={autoplay} onCheckedChange={setAutoplay} />}
          />
          <SettingsRow
            htmlFor="video-loop"
            title={t('Video loop')}
            description={t('Automatically replay videos when they end')}
            control={
              <Switch id="video-loop" checked={videoLoop} onCheckedChange={setVideoLoop} />
            }
          />
        </SettingsGroup>

        <SettingsGroup title={t('Content filtering')}>
          <SettingsRow
            htmlFor="hide-content-mentioning-muted-users"
            title={t('Hide content mentioning muted users')}
            control={
              <Switch
                id="hide-content-mentioning-muted-users"
                checked={hideContentMentioningMutedUsers}
                onCheckedChange={setHideContentMentioningMutedUsers}
              />
            }
          />
          <SettingsRow
            htmlFor="nsfw-display-policy"
            title={t('NSFW content display')}
            control={
              <Select
                value={nsfwDisplayPolicy}
                onValueChange={(value: TNsfwDisplayPolicy) => setNsfwDisplayPolicy(value)}
              >
                <SelectTrigger id="nsfw-display-policy" className="w-44">
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
            }
          />
          <DefaultTrustScoreFilter />
          <MutedWords />
        </SettingsGroup>

        <SettingsGroup title={t('Reactions')}>
          <SettingsRow
            htmlFor="quick-reaction"
            title={t('Quick reaction')}
            description={t(
              'If enabled, you can react with a single click. Click and hold for more options'
            )}
            control={
              <Switch
                id="quick-reaction"
                checked={quickReaction}
                onCheckedChange={updateQuickReaction}
              />
            }
          />
          {quickReaction && (
            <SettingsRow
              htmlFor="quick-reaction-emoji"
              title={t('Quick reaction emoji')}
              control={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateQuickReactionEmoji('+')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw />
                  </Button>
                  <ExpressionPickerDialog
                    onEmojiClick={(emoji) => {
                      if (!emoji) return
                      updateQuickReactionEmoji(emoji)
                    }}
                  >
                    <Button variant="ghost" size="icon" className="border">
                      <Emoji emoji={quickReactionEmoji} />
                    </Button>
                  </ExpressionPickerDialog>
                </div>
              }
            />
          )}
        </SettingsGroup>

        <SettingsGroup title={t('Notifications')}>
          <SettingsRow
            htmlFor="disable-notification-sync"
            title={t('Do not sync notification read status')}
            description={t('Only update read status locally without publishing to relays')}
            control={
              <Switch
                id="disable-notification-sync"
                checked={disableNotificationSync}
                onCheckedChange={(checked) => {
                  setDisableNotificationSync(checked)
                  localStorage.setDisableNotificationSync(checked)
                }}
              />
            }
          />
        </SettingsGroup>
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})
GeneralSettingsPage.displayName = 'GeneralSettingsPage'
export default GeneralSettingsPage
