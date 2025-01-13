import AboutInfoDialog from '@/components/AboutInfoDialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toRelaySettings } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useTheme } from '@/providers/ThemeProvider'
import { TLanguage } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { ChevronRight, Info, Languages, Server, SunMoon } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function SettingsPage({ index }: { index?: number }) {
  const { t, i18n } = useTranslation()
  const { push } = useSecondaryPage()
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const { themeSetting, setThemeSetting } = useTheme()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  return (
    <SecondaryPageLayout index={index} titlebarContent={t('Settings')}>
      <SettingItem>
        <div className="flex items-center gap-4">
          <Languages />
          <div>{t('Languages')}</div>
        </div>
        <Select defaultValue="en" value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">简体中文</SelectItem>
          </SelectContent>
        </Select>
      </SettingItem>
      <SettingItem>
        <div className="flex items-center gap-4">
          <SunMoon />
          <div>{t('Theme')}</div>
        </div>
        <Select defaultValue="system" value={themeSetting} onValueChange={setThemeSetting}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t('System')}</SelectItem>
            <SelectItem value="light">{t('Light')}</SelectItem>
            <SelectItem value="dark">{t('Dark')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingItem>
      <SettingItem onClick={() => push(toRelaySettings())}>
        <div className="flex items-center gap-4">
          <Server />
          <div>{t('Relays')}</div>
        </div>
        <ChevronRight />
      </SettingItem>
      <AboutInfoDialog>
        <SettingItem>
          <div className="flex items-center gap-4">
            <Info />
            <div>{t('About')}</div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="text-muted-foreground">
              v{__APP_VERSION__} ({__GIT_COMMIT__})
            </div>
            <ChevronRight />
          </div>
        </SettingItem>
      </AboutInfoDialog>
    </SecondaryPageLayout>
  )
}

const SettingItem = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  ({ children, className, ...props }) => {
    return (
      <div
        className={cn(
          'flex clickable justify-between items-center px-4 py-2 h-[52px] rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SettingItem.displayName = 'SettingItem'
