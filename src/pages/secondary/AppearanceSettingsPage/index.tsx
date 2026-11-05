import { SettingsPageContainer, SettingsSection } from '@/components/ui/settings'
import { PRIMARY_COLORS, PROFILE_PICTURE_AUTO_LOAD_POLICY, TPrimaryColor } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TProfilePictureAutoLoadPolicy } from '@/types'
import { Check, Columns2, LayoutList, List, Monitor, Moon, PanelLeft, Sun } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const THEMES = [
  { key: 'system', label: 'System', icon: <Monitor className="size-5" /> },
  { key: 'light', label: 'Light', icon: <Sun className="size-5" /> },
  { key: 'dark', label: 'Dark', icon: <Moon className="size-5" /> },
  { key: 'pure-black', label: 'Pure Black', icon: <Moon className="size-5 fill-current" /> }
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
  const { themeSetting, setThemeSetting, primaryColor, setPrimaryColor } = useTheme()
  const { profilePictureAutoLoadPolicy, setProfilePictureAutoLoadPolicy } = useContentPolicy()
  const {
    enableSingleColumnLayout,
    updateEnableSingleColumnLayout,
    notificationListStyle,
    updateNotificationListStyle
  } = useUserPreferences()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Appearance')}>
      <SettingsPageContainer>
        <SettingsSection title={t('Theme')}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {THEMES.map(({ key, label, icon }) => (
              <OptionTile
                key={key}
                isSelected={themeSetting === key}
                icon={icon}
                label={t(label)}
                onClick={() => setThemeSetting(key)}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title={t('Primary color')}>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PRIMARY_COLORS).map(([key, config]) => (
              <ColorTile
                key={key}
                isSelected={primaryColor === key}
                color={`hsl(${config.light.primary})`}
                label={t(config.name)}
                onClick={() => setPrimaryColor(key as TPrimaryColor)}
              />
            ))}
          </div>
        </SettingsSection>

        {!isSmallScreen && (
          <SettingsSection title={t('Column layout')}>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS.map(({ key, label, icon }) => (
                <OptionTile
                  key={key.toString()}
                  isSelected={enableSingleColumnLayout === key}
                  icon={icon}
                  label={t(label)}
                  onClick={() => updateEnableSingleColumnLayout(key)}
                />
              ))}
            </div>
          </SettingsSection>
        )}

        <SettingsSection title={t('Notification list style')}>
          <div className="grid grid-cols-2 gap-2">
            {NOTIFICATION_STYLES.map(({ key, label, icon }) => (
              <OptionTile
                key={key}
                isSelected={notificationListStyle === key}
                icon={icon}
                label={t(label)}
                onClick={() => updateNotificationListStyle(key)}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title={t('Show avatars')}>
          <div className="grid grid-cols-2 gap-2">
            <AvatarPolicyTile
              showAvatar
              label={t('Show')}
              isSelected={profilePictureAutoLoadPolicy !== PROFILE_PICTURE_AUTO_LOAD_POLICY.NEVER}
              onClick={() =>
                setProfilePictureAutoLoadPolicy(
                  PROFILE_PICTURE_AUTO_LOAD_POLICY.ALWAYS as TProfilePictureAutoLoadPolicy
                )
              }
            />
            <AvatarPolicyTile
              label={t('Hide')}
              isSelected={profilePictureAutoLoadPolicy === PROFILE_PICTURE_AUTO_LOAD_POLICY.NEVER}
              onClick={() =>
                setProfilePictureAutoLoadPolicy(
                  PROFILE_PICTURE_AUTO_LOAD_POLICY.NEVER as TProfilePictureAutoLoadPolicy
                )
              }
            />
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})
AppearanceSettingsPage.displayName = 'AppearanceSettingsPage'
export default AppearanceSettingsPage

const tileBase =
  'group relative flex flex-col items-center gap-2 rounded-lg border bg-card p-3 transition-colors'
const tileSelected = 'border-primary bg-primary/5'
const tileIdle = 'border-border hover:bg-muted/50'

const OptionTile = ({
  isSelected,
  onClick,
  icon,
  label
}: {
  isSelected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) => {
  return (
    <button onClick={onClick} className={cn(tileBase, isSelected ? tileSelected : tileIdle)}>
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center transition-colors',
          isSelected ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {icon}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

const ColorTile = ({
  isSelected,
  color,
  label,
  onClick
}: {
  isSelected: boolean
  color: string
  label: string
  onClick: () => void
}) => {
  return (
    <button onClick={onClick} className={cn(tileBase, isSelected ? tileSelected : tileIdle)}>
      <div
        className="flex size-9 items-center justify-center rounded-full shadow-md"
        style={{ backgroundColor: color }}
      >
        {isSelected && <Check className="text-primary-foreground size-5" />}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

const NoteSkeletonLine = ({ className }: { className?: string }) => (
  <div className={cn('bg-muted-foreground/20 h-1.5 rounded-full', className)} />
)

const AvatarPolicyTile = ({
  showAvatar,
  label,
  isSelected,
  onClick
}: {
  showAvatar?: boolean
  label?: string
  isSelected: boolean
  onClick: () => void
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(tileBase, 'gap-3', isSelected ? tileSelected : tileIdle)}
    >
      <div className="flex w-full items-center gap-1.5">
        {showAvatar && <div className="bg-muted-foreground/20 size-5 shrink-0 rounded-full" />}
        <div className="flex flex-1 flex-col gap-1">
          <NoteSkeletonLine className="w-8" />
          <NoteSkeletonLine className="w-5" />
        </div>
      </div>
      <div className="flex w-full flex-col gap-1">
        <NoteSkeletonLine className="w-full" />
        <NoteSkeletonLine className="w-2/3" />
      </div>
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  )
}
