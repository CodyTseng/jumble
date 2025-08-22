import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { LocalizedLanguageNames, TLanguage } from '@/i18n'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { SelectValue } from '@radix-ui/react-select'
import { ExternalLink } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GeneralSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const { themeSetting, setThemeSetting } = useTheme()
  const { autoplay, setAutoplay, defaultShowNsfw, setDefaultShowNsfw } = useContentPolicy()
  const { hideUntrustedNotes, updateHideUntrustedNotes } = useUserTrust()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('General')}>
      <div className="space-y-4 mt-2">
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
          <Label htmlFor="theme" className="text-base font-normal">
            {t('Theme')}
          </Label>
          <Select defaultValue="system" value={themeSetting} onValueChange={setThemeSetting}>
            <SelectTrigger id="theme" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('System')}</SelectItem>
              <SelectItem value="light">{t('Light')}</SelectItem>
              <SelectItem value="dark">{t('Dark')}</SelectItem>
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
