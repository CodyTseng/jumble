import { Label } from '@/components/ui/label'
import { PRIMARY_COLORS, TPrimaryColor } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Columns2, LayoutList, List, Monitor, Moon, PanelLeft, Sun, Globe } from 'lucide-react'
import { forwardRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const THEMES = [
  { key: 'system', label: 'System', icon: <Monitor className="size-5" /> },
  { key: 'light', label: 'Light', icon: <Sun className="size-5" /> },
  { key: 'dark', label: 'Dark', icon: <Moon className="size-5" /> },
  { key: 'pure-black', label: 'Pure Black', icon: <Moon className="size-5 fill-current" /> },
  { key: 'community', label: 'Community Theme', icon: <Globe className="size-5" /> }
] as const

const LAYOUTS = [
  { key: false, label: 'Two-column', icon: <Columns2 className="size-5" /> },
  { key: true, label: 'Single-column', icon: <PanelLeft className="size-5" /> }
] as const

const NOTIFICATION_STYLES = [
  { key: 'detailed', label: 'Detailed', icon: <LayoutList className="size-5" /> },
  { key: 'compact', label: 'Compact', icon: <List className="size-5" /> }
] as const

const AppearanceSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const {
    themeSetting,
    setThemeSetting,
    primaryColor,
    setPrimaryColor,
    communityDomain,
    setCommunityDomain,
    communityThemeAvailable,
    isCommunityThemeLoading
  } = useTheme()
  const {
    enableSingleColumnLayout,
    updateEnableSingleColumnLayout,
    notificationListStyle,
    updateNotificationListStyle
  } = useUserPreferences()
  const { profile } = useNostr()

  // Auto-detect community domain from user's NIP-05
  useEffect(() => {
    if (profile?.nip05) {
      const [, domain] = profile.nip05.split('@')
      if (domain && domain !== communityDomain) {
        setCommunityDomain(domain)
      }
    } else if (!profile?.nip05 && communityDomain) {
      // Clear community domain if user no longer has NIP-05
      setCommunityDomain(null)
    }
  }, [profile?.nip05, communityDomain, setCommunityDomain])

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Appearance')}>
      <div className="space-y-4 my-3">
        <div className="flex flex-col gap-2 px-4">
          <Label className="text-base">{t('Theme')}</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {THEMES.map(({ key, label, icon }) => {
              // Disable community theme if no domain is set or theme is loading
              const isDisabled = key === 'community' && !communityDomain
              return (
                <OptionButton
                  key={key}
                  isSelected={themeSetting === key}
                  icon={icon}
                  label={t(label)}
                  onClick={() => !isDisabled && setThemeSetting(key)}
                  disabled={isDisabled}
                />
              )
            })}
          </div>
          {themeSetting === 'community' && communityDomain && (
            <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
              {isCommunityThemeLoading ? (
                <p className="text-muted-foreground">{t('Loading community theme...')}</p>
              ) : communityThemeAvailable ? (
                <p className="text-green-600 dark:text-green-400">
                  ✓ {t('Using theme from')}: {communityDomain}
                </p>
              ) : (
                <p className="text-yellow-600 dark:text-yellow-400">
                  ⚠ {t('No theme.json found for')}: {communityDomain}
                </p>
              )}
            </div>
          )}
          {themeSetting === 'community' && !communityDomain && (
            <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm">
              <p className="text-muted-foreground">
                {t('Community theme requires a NIP-05 address. Add one in your profile settings.')}
              </p>
            </div>
          )}
        </div>
        {!isSmallScreen && (
          <div className="flex flex-col gap-2 px-4">
            <Label className="text-base">{t('Layout')}</Label>
            <div className="grid grid-cols-2 gap-4 w-full">
              {LAYOUTS.map(({ key, label, icon }) => (
                <OptionButton
                  key={key.toString()}
                  isSelected={enableSingleColumnLayout === key}
                  icon={icon}
                  label={t(label)}
                  onClick={() => updateEnableSingleColumnLayout(key)}
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 px-4">
          <Label className="text-base">{t('Notification list style')}</Label>
          <div className="grid grid-cols-2 gap-4 w-full">
            {NOTIFICATION_STYLES.map(({ key, label, icon }) => (
              <OptionButton
                key={key}
                isSelected={notificationListStyle === key}
                icon={icon}
                label={t(label)}
                onClick={() => updateNotificationListStyle(key)}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 px-4">
          <Label className="text-base">{t('Primary color')}</Label>
          <div className="grid grid-cols-4 gap-4 w-full">
            {Object.entries(PRIMARY_COLORS).map(([key, config]) => (
              <OptionButton
                key={key}
                isSelected={primaryColor === key}
                icon={
                  <div
                    className="size-8 rounded-full shadow-md"
                    style={{
                      backgroundColor: `hsl(${config.light.primary})`
                    }}
                  />
                }
                label={t(config.name)}
                onClick={() => setPrimaryColor(key as TPrimaryColor)}
              />
            ))}
          </div>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
AppearanceSettingsPage.displayName = 'AppearanceSettingsPage'
export default AppearanceSettingsPage

const OptionButton = ({
  isSelected,
  onClick,
  icon,
  label,
  disabled
}: {
  isSelected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-all',
        isSelected ? 'border-primary' : 'border-border hover:border-muted-foreground/40',
        disabled && 'opacity-50 cursor-not-allowed hover:border-border'
      )}
    >
      <div className="flex items-center justify-center w-8 h-8">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
