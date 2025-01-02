import AboutInfoDialog from '@/components/AboutInfoDialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTheme } from '@/providers/ThemeProvider'
import { TLanguage } from '@/types'
import { SelectValue } from '@radix-ui/react-select'
import { ChevronRight, Info, Languages, SunMoon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function SettingsPage({ index }: { index?: number }) {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<TLanguage>(i18n.language as TLanguage)
  const { themeSetting, setThemeSetting } = useTheme()

  const handleLanguageChange = (value: TLanguage) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  return (
    <SecondaryPageLayout index={index} titlebarContent={t('Settings')}>
      <div className="flex flex-col">
        <div className="flex justify-between items-center p-4 [&_svg]:size-4 [&_svg]:shrink-0">
          <div className="flex items-center gap-4">
            <Languages />
            <div>{t('Languages')}</div>
          </div>
          <Select defaultValue="en" value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('English')}</SelectItem>
              <SelectItem value="zh">{t('Chinese')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-between items-center p-4 [&_svg]:size-4 [&_svg]:shrink-0">
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
        </div>
        <AboutInfoDialog>
          <div className="flex clickable justify-between items-center p-4 rounded-lg [&_svg]:size-4 [&_svg]:shrink-0">
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
          </div>
        </AboutInfoDialog>
      </div>
    </SecondaryPageLayout>
  )
}
