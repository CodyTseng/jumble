import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  BUTTON_RADIUS_VALUES,
  CARD_RADIUS_VALUES,
  DECK_VIEW_MODE,
  FONT_FAMILIES,
  FONT_SIZES,
  LAYOUT_MODE,
  NOTIFICATION_LIST_STYLE,
  POST_BUTTON_STYLE,
  PRIMARY_COLORS
} from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useButtonRadius } from '@/providers/ButtonRadiusProvider'
import { useCardRadius } from '@/providers/CardRadiusProvider'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { useDeckView } from '@/providers/DeckViewProvider'
import { useFontFamily } from '@/providers/FontFamilyProvider'
import { useFontSize } from '@/providers/FontSizeProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { usePageTheme } from '@/providers/PageThemeProvider'
import { usePostButtonStyle } from '@/providers/PostButtonStyleProvider'
import { usePrimaryColor } from '@/providers/PrimaryColorProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TFontFamily, TPrimaryColor } from '@/types'
import { Check, Moon, Sun, Monitor, LayoutGrid, Maximize2, List, FileText, Columns, PencilLine } from 'lucide-react'
import { forwardRef, HTMLProps } from 'react'
import { useTranslation } from 'react-i18next'

const AppearanceSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { themeSetting, setThemeSetting } = useTheme()
  const { pageTheme, setPageTheme } = usePageTheme()
  const { fontSize, setFontSize } = useFontSize()
  const { fontFamily, setFontFamily } = useFontFamily()
  const { primaryColor, setPrimaryColor } = usePrimaryColor()
  const { layoutMode, setLayoutMode } = useLayoutMode()
  const { deckViewMode, setDeckViewMode } = useDeckView()
  const { notificationListStyle, updateNotificationListStyle } = useUserPreferences()
  const { buttonRadius, setButtonRadius } = useButtonRadius()
  const { postButtonStyle, setPostButtonStyle } = usePostButtonStyle()
  const { cardRadius, setCardRadius } = useCardRadius()
  const { compactSidebar, setCompactSidebar } = useCompactSidebar()

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />
      case 'dark':
        return <Moon className="w-5 h-5" />
      case 'pure-black':
        return <Moon className="w-5 h-5 fill-current" />
      case 'white':
        return <Sun className="w-5 h-5 stroke-[3]" />
      case 'system':
        return <Monitor className="w-5 h-5" />
      default:
        return null
    }
  }

  const getThemeLabel = (theme: string) => {
    switch (theme) {
      case 'pure-black':
        return 'Black'
      case 'white':
        return 'White'
      default:
        return t(theme)
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Appearance')}>
      <div className="space-y-4 mt-3">
        <SettingItem className="flex-col items-start gap-3">
          <Label className="text-base font-normal">
            {t('Theme')}
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
            {(['system', 'light', 'dark', 'white', 'pure-black'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => {
                  if (theme === 'pure-black') {
                    setThemeSetting('dark')
                    setPageTheme('pure-black')
                  } else if (theme === 'white') {
                    setThemeSetting('light')
                    setPageTheme('white')
                  } else {
                    setThemeSetting(theme)
                    setPageTheme('default')
                  }
                }}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                  (theme === 'pure-black' && pageTheme === 'pure-black') ||
                  (theme === 'white' && pageTheme === 'white') ||
                  (theme !== 'pure-black' && theme !== 'white' && themeSetting === theme && pageTheme === 'default')
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8">
                  {getThemeIcon(theme)}
                </div>
                <span className="text-xs font-medium capitalize">{getThemeLabel(theme)}</span>
                {((theme === 'pure-black' && pageTheme === 'pure-black') ||
                  (theme === 'white' && pageTheme === 'white') ||
                  (theme !== 'pure-black' && theme !== 'white' && themeSetting === theme && pageTheme === 'default')) && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <Label className="text-base font-normal">
            {t('Layout mode')}
          </Label>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={() => setLayoutMode(LAYOUT_MODE.BOXED)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                layoutMode === LAYOUT_MODE.BOXED
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{t('Boxed')}</span>
              {layoutMode === LAYOUT_MODE.BOXED && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
            <button
              onClick={() => setLayoutMode(LAYOUT_MODE.FULL_WIDTH)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                layoutMode === LAYOUT_MODE.FULL_WIDTH
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8">
                <Maximize2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{t('Full width')}</span>
              {layoutMode === LAYOUT_MODE.FULL_WIDTH && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          </div>
        </SettingItem>
        {layoutMode === LAYOUT_MODE.FULL_WIDTH && (
          <SettingItem className="flex-col items-start gap-3">
            <Label className="text-base font-normal">
              {t('Multi-Column (Deck)')}
            </Label>
            <div className="text-sm text-muted-foreground mb-1">
              {t('Allows you to pin feeds as new columns')}
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => setDeckViewMode(DECK_VIEW_MODE.STANDARD)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                  deckViewMode === DECK_VIEW_MODE.STANDARD
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{t('Standard')}</span>
                {deckViewMode === DECK_VIEW_MODE.STANDARD && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
              <button
                onClick={() => setDeckViewMode(DECK_VIEW_MODE.MULTI_COLUMN)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                  deckViewMode === DECK_VIEW_MODE.MULTI_COLUMN
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8">
                  <Columns className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{t('Multi-Column')}</span>
                {deckViewMode === DECK_VIEW_MODE.MULTI_COLUMN && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            </div>
          </SettingItem>
        )}
        <SettingItem className="flex-col items-start gap-3">
          <Label className="text-base font-normal">
            {t('Notification list style')}
          </Label>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={() => updateNotificationListStyle(NOTIFICATION_LIST_STYLE.COMPACT)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                notificationListStyle === NOTIFICATION_LIST_STYLE.COMPACT
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8">
                <List className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{t('Compact')}</span>
              {notificationListStyle === NOTIFICATION_LIST_STYLE.COMPACT && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
            <button
              onClick={() => updateNotificationListStyle(NOTIFICATION_LIST_STYLE.DETAILED)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                notificationListStyle === NOTIFICATION_LIST_STYLE.DETAILED
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{t('Detailed')}</span>
              {notificationListStyle === NOTIFICATION_LIST_STYLE.DETAILED && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <Label className="text-base font-normal">
            {t('Primary color')}
          </Label>
          <div className="grid grid-cols-4 gap-3 w-full">
            {Object.entries(PRIMARY_COLORS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setPrimaryColor(key as TPrimaryColor)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                  primaryColor === key
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-md"
                  style={{
                    backgroundColor: `hsl(${config.light})`
                  }}
                />
                <span className="text-xs font-medium">{config.name}</span>
                {primaryColor === key && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <div className="w-full">
            <Label className="text-base font-normal">{t('Button radius')}</Label>
            <div className="text-sm text-muted-foreground">
              {buttonRadius === 9999
                ? t('Fully rounded')
                : buttonRadius === 0
                  ? t('Square corners')
                  : `${buttonRadius}px`}
            </div>
          </div>
          <div className="w-full px-2">
            <Slider
              min={0}
              max={BUTTON_RADIUS_VALUES.length - 1}
              step={1}
              value={[BUTTON_RADIUS_VALUES.indexOf(buttonRadius as any)]}
              onValueChange={(value) => {
                setButtonRadius(BUTTON_RADIUS_VALUES[value[0]])
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{t('Square')}</span>
              <span>{t('Round')}</span>
            </div>
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <Label className="text-base font-normal">
            {t('Post button style')}
          </Label>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={() => setPostButtonStyle(POST_BUTTON_STYLE.FILLED)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                postButtonStyle === POST_BUTTON_STYLE.FILLED
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full">
                <PencilLine className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium">{t('Filled')}</span>
              {postButtonStyle === POST_BUTTON_STYLE.FILLED && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
            <button
              onClick={() => setPostButtonStyle(POST_BUTTON_STYLE.OUTLINED)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                postButtonStyle === POST_BUTTON_STYLE.OUTLINED
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8 border-2 border-primary rounded-full">
                <PencilLine className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-medium">{t('Outlined')}</span>
              {postButtonStyle === POST_BUTTON_STYLE.OUTLINED && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <div className="w-full">
            <Label className="text-base font-normal">{t('Feed / Card radius')}</Label>
            <div className="text-sm text-muted-foreground">
              {cardRadius === 0 ? t('Square corners') : `${cardRadius}px`}
            </div>
          </div>
          <div className="w-full px-2">
            <Slider
              min={0}
              max={CARD_RADIUS_VALUES.length - 1}
              step={1}
              value={[CARD_RADIUS_VALUES.indexOf(cardRadius as any)]}
              onValueChange={(value) => {
                setCardRadius(CARD_RADIUS_VALUES[value[0]])
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{t('Square')}</span>
              <span>{t('Round')}</span>
            </div>
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <Label className="text-base font-normal">
            {t('Font family')}
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            {Object.entries(FONT_FAMILIES).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setFontFamily(key as TFontFamily)}
                className={cn(
                  'relative flex items-center justify-center p-4 rounded-lg border-2 transition-all hover:scale-105 min-h-[80px]',
                  fontFamily === key
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <span className="text-base font-medium" style={{ fontFamily: config.value }}>
                  {config.name}
                </span>
                {fontFamily === key && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </SettingItem>
        <SettingItem className="flex-col items-start gap-3">
          <div className="w-full">
            <Label className="text-base font-normal">{t('Font size')}</Label>
            <div className="text-sm text-muted-foreground">{fontSize}px</div>
          </div>
          <div className="w-full px-2">
            <Slider
              min={0}
              max={FONT_SIZES.length - 1}
              step={1}
              value={[FONT_SIZES.indexOf(fontSize as any)]}
              onValueChange={(value) => {
                setFontSize(FONT_SIZES[value[0]])
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{FONT_SIZES[0]}px</span>
              <span>{FONT_SIZES[FONT_SIZES.length - 1]}px</span>
            </div>
          </div>
        </SettingItem>
        <SettingItem>
          <Label htmlFor="compact-sidebar" className="text-base font-normal">
            <div>{t('Compact sidebar')}</div>
            <div className="text-muted-foreground">
              {t('Show only icons in the sidebar')}
            </div>
          </Label>
          <Switch
            id="compact-sidebar"
            checked={compactSidebar}
            onCheckedChange={setCompactSidebar}
          />
        </SettingItem>
      </div>
    </SecondaryPageLayout>
  )
})
AppearanceSettingsPage.displayName = 'AppearanceSettingsPage'
export default AppearanceSettingsPage

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
