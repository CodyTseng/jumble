import { Label } from '@/components/ui/label'
import { PRIMARY_COLORS, TPrimaryColor } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/providers/ThemeProvider'
import { Monitor, Moon, Sun } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const THEMES = [
  { key: 'system', label: 'System', icon: <Monitor className="w-5 h-5" /> },
  { key: 'light', label: 'Light', icon: <Sun className="w-5 h-5" /> },
  { key: 'dark', label: 'Dark', icon: <Moon className="w-5 h-5" /> },
  { key: 'pure-black', label: 'Pure Black', icon: <Moon className="w-5 h-5 fill-current" /> }
] as const

const AppearanceSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { themeSetting, setThemeSetting, primaryColor, setPrimaryColor } = useTheme()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Appearance')}>
      <div className="space-y-4 my-3">
        <div className="flex flex-col gap-2 px-4">
          <Label className="text-base">{t('Theme')}</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {THEMES.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => {
                  setThemeSetting(key)
                }}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-all',
                  themeSetting === key
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8">{icon}</div>
                <span className="text-xs font-medium">{t(label)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 px-4">
          <Label className="text-base">{t('Primary color')}</Label>
          <div className="grid grid-cols-4 gap-4 w-full">
            {Object.entries(PRIMARY_COLORS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setPrimaryColor(key as TPrimaryColor)}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-all',
                  primaryColor === key
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <div
                  className="size-8 rounded-full shadow-md"
                  style={{
                    backgroundColor: `hsl(${config.light.primary})`
                  }}
                />
                <span className="text-xs font-medium">{t(config.name)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
AppearanceSettingsPage.displayName = 'AppearanceSettingsPage'
export default AppearanceSettingsPage
