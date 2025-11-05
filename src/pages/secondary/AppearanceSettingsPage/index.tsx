import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import Tabs from '@/components/Tabs'
import {
  BUTTON_RADIUS_VALUES,
  CARD_RADIUS_VALUES,
  DECK_VIEW_MODE,
  FONT_FAMILIES,
  FONT_SIZES,
  TITLE_FONT_SIZES,
  LOGO_FONT_SIZES,
  LAYOUT_MODE,
  MEDIA_STYLE,
  NOTIFICATION_LIST_STYLE,
  POST_BUTTON_STYLE,
  PRIMARY_COLORS
} from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { cn } from '@/lib/utils'
import { useButtonRadius } from '@/providers/ButtonRadiusProvider'
import { useCardRadius } from '@/providers/CardRadiusProvider'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { useLogoStyle } from '@/providers/LogoStyleProvider'
import { useLogoFontSize } from '@/providers/LogoFontSizeProvider'
import { useDeckView } from '@/providers/DeckViewProvider'
import { useFontFamily } from '@/providers/FontFamilyProvider'
import { useFontSize } from '@/providers/FontSizeProvider'
import { useTitleFontSize } from '@/providers/TitleFontSizeProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { useMediaStyle } from '@/providers/MediaStyleProvider'
import { usePageTheme } from '@/providers/PageThemeProvider'
import { usePostButtonStyle } from '@/providers/PostButtonStyleProvider'
import { usePrimaryColor } from '@/providers/PrimaryColorProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { useColorPalette } from '@/providers/ColorPaletteProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TFontFamily, TPrimaryColor, TColorPalette } from '@/types'
import { Check, Moon, Sun, Monitor, LayoutGrid, Maximize2, List, FileText, Columns, PencilLine, Image } from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const getPaletteColor = (palette: TColorPalette, theme: string, type: 'background' | 'muted' | 'border') => {
  // Color palette HSL values for preview (background is darker, card/muted is lighter)
  const colors: Record<TColorPalette, { light: Record<string, string>, dark: Record<string, string> }> = {
    default: {
      light: { background: 'hsl(0, 0%, 98%)', muted: 'hsl(0, 0%, 100%)', border: 'hsl(240, 5.9%, 94%)' },
      dark: { background: 'hsl(240, 3.7%, 15.9%)', muted: 'hsl(0, 0%, 9%)', border: 'hsl(240, 3.7%, 15.9%)' }
    },
    slate: {
      light: { background: 'hsl(215, 20.2%, 98%)', muted: 'hsl(0, 0%, 100%)', border: 'hsl(214.3, 31.8%, 91.4%)' },
      dark: { background: 'hsl(222.2, 47.4%, 11.2%)', muted: 'hsl(222.2, 84%, 4.9%)', border: 'hsl(217.2, 32.6%, 17.5%)' }
    },
    gray: {
      light: { background: 'hsl(220, 14.3%, 98%)', muted: 'hsl(0, 0%, 100%)', border: 'hsl(220, 13%, 91%)' },
      dark: { background: 'hsl(215, 27.9%, 16.9%)', muted: 'hsl(220.9, 39.3%, 11%)', border: 'hsl(215, 27.9%, 16.9%)' }
    },
    zinc: {
      light: { background: 'hsl(240, 4.8%, 98%)', muted: 'hsl(0, 0%, 100%)', border: 'hsl(240, 5.9%, 90%)' },
      dark: { background: 'hsl(240, 5.9%, 10%)', muted: 'hsl(240, 10%, 3.9%)', border: 'hsl(240, 3.7%, 15.9%)' }
    },
    neutral: {
      light: { background: 'hsl(0, 0%, 98%)', muted: 'hsl(0, 0%, 100%)', border: 'hsl(0, 0%, 89.8%)' },
      dark: { background: 'hsl(0, 0%, 10%)', muted: 'hsl(0, 0%, 3.9%)', border: 'hsl(0, 0%, 14.9%)' }
    },
    stone: {
      light: { background: 'hsl(60, 9.1%, 98%)', muted: 'hsl(0, 0%, 100%)', border: 'hsl(20, 5.9%, 90%)' },
      dark: { background: 'hsl(12, 6.5%, 15.1%)', muted: 'hsl(24, 9.8%, 10%)', border: 'hsl(12, 6.5%, 15.1%)' }
    }
  }

  return colors[palette][theme === 'dark' ? 'dark' : 'light'][type]
}

const AppearanceSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('theme')
  const { themeSetting, setThemeSetting, theme } = useTheme()
  const { colorPalette, setColorPalette } = useColorPalette()
  const { pageTheme, setPageTheme } = usePageTheme()
  const { fontSize, setFontSize } = useFontSize()
  const { titleFontSize, setTitleFontSize } = useTitleFontSize()
  const { fontFamily, setFontFamily } = useFontFamily()
  const { primaryColor, setPrimaryColor } = usePrimaryColor()
  const { layoutMode, setLayoutMode } = useLayoutMode()
  const { mediaStyle, setMediaStyle } = useMediaStyle()
  const { deckViewMode, setDeckViewMode } = useDeckView()
  const { notificationListStyle, updateNotificationListStyle } = useUserPreferences()
  const { buttonRadius, setButtonRadius } = useButtonRadius()
  const { postButtonStyle, setPostButtonStyle } = usePostButtonStyle()
  const { cardRadius, setCardRadius } = useCardRadius()
  const { compactSidebar, setCompactSidebar } = useCompactSidebar()
  const { logoStyle, setLogoStyle, customLogoText, setCustomLogoText } = useLogoStyle()
  const { logoFontSize, setLogoFontSize } = useLogoFontSize()

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

  const tabDefinitions = [
    { value: 'theme', label: 'Theme' },
    { value: 'layout', label: 'Layout' },
    { value: 'typography', label: 'Typography' },
    { value: 'styling', label: 'Styling' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Appearance')}>
      <div className="mt-3">
        <Tabs
          tabs={tabDefinitions}
          value={activeTab}
          onTabChange={setActiveTab}
          threshold={0}
        />

        {/* THEME TAB */}
        {activeTab === 'theme' && (
          <div className="space-y-4 mt-4">
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
            {themeSetting !== 'system' && pageTheme === 'default' && (
              <SettingItem className="flex-col items-start gap-3">
                <Label className="text-base font-normal">
                  {t('Color Palette')}
                </Label>
                <div className="text-sm text-muted-foreground mb-1">
                  {t('Choose a color palette for')} {themeSetting === 'light' ? t('light') : t('dark')} {t('theme')}
                </div>
                <div className="grid grid-cols-3 gap-3 w-full">
                  {(['default', 'slate', 'gray', 'zinc', 'neutral', 'stone'] as TColorPalette[]).map((palette) => (
                    <button
                      key={palette}
                      onClick={() => setColorPalette(palette)}
                      className={cn(
                        'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                        colorPalette === palette
                          ? 'border-primary'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <div className="flex gap-1">
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{
                            backgroundColor: getPaletteColor(palette, theme, 'background'),
                            borderColor: getPaletteColor(palette, theme, 'border')
                          }}
                        />
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{
                            backgroundColor: getPaletteColor(palette, theme, 'muted'),
                            borderColor: getPaletteColor(palette, theme, 'border')
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium capitalize">{palette}</span>
                      {colorPalette === palette && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </SettingItem>
            )}
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
          </div>
        )}

        {/* LAYOUT TAB */}
        {activeTab === 'layout' && (
          <div className="space-y-4 mt-4">
            <SettingItem className="flex-col items-start gap-3">
              <Label className="text-base font-normal">
                {t('Logo style')}
              </Label>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => setLogoStyle('image')}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                    logoStyle === 'image'
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <Image className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Image Logo')}</span>
                  {logoStyle === 'image' && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setLogoStyle('text')}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                    logoStyle === 'text'
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Text Logo')}</span>
                  {logoStyle === 'text' && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
              {logoStyle === 'text' && (
                <div className="w-full space-y-2">
                  <Label htmlFor="custom-logo-text" className="text-sm text-muted-foreground">
                    {t('Custom logo text')}
                  </Label>
                  <Input
                    id="custom-logo-text"
                    type="text"
                    value={customLogoText}
                    onChange={(e) => setCustomLogoText(e.target.value)}
                    placeholder={t('Enter your custom text')}
                    className="w-full"
                    maxLength={50}
                  />
                </div>
              )}
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
                {t('Media style')}
              </Label>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => setMediaStyle(MEDIA_STYLE.DEFAULT)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                    mediaStyle === MEDIA_STYLE.DEFAULT
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <Image className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Default')}</span>
                  {mediaStyle === MEDIA_STYLE.DEFAULT && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setMediaStyle(MEDIA_STYLE.FULL_WIDTH)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105',
                    mediaStyle === MEDIA_STYLE.FULL_WIDTH
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8">
                    <Maximize2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{t('Full width')}</span>
                  {mediaStyle === MEDIA_STYLE.FULL_WIDTH && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              </div>
            </SettingItem>
          </div>
        )}

        {/* TYPOGRAPHY TAB */}
        {activeTab === 'typography' && (
          <div className="space-y-4 mt-4">
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
            <SettingItem className="flex-col items-start gap-3">
              <div className="w-full">
                <Label className="text-base font-normal">{t('Title font size')}</Label>
                <div className="text-sm text-muted-foreground">{titleFontSize}px</div>
              </div>
              <div className="w-full px-2">
                <Slider
                  min={0}
                  max={TITLE_FONT_SIZES.length - 1}
                  step={1}
                  value={[TITLE_FONT_SIZES.indexOf(titleFontSize as any)]}
                  onValueChange={(value) => {
                    setTitleFontSize(TITLE_FONT_SIZES[value[0]])
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{TITLE_FONT_SIZES[0]}px</span>
                  <span>{TITLE_FONT_SIZES[TITLE_FONT_SIZES.length - 1]}px</span>
                </div>
              </div>
            </SettingItem>
            {logoStyle === 'text' && (
              <SettingItem className="flex-col items-start gap-3">
                <div className="w-full">
                  <Label className="text-base font-normal">{t('Logo font size')}</Label>
                  <div className="text-sm text-muted-foreground">{logoFontSize}px</div>
                </div>
                <div className="w-full px-2">
                  <Slider
                    min={0}
                    max={LOGO_FONT_SIZES.length - 1}
                    step={1}
                    value={[LOGO_FONT_SIZES.indexOf(logoFontSize as any)]}
                    onValueChange={(value) => {
                      setLogoFontSize(LOGO_FONT_SIZES[value[0]])
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{LOGO_FONT_SIZES[0]}px</span>
                    <span>{LOGO_FONT_SIZES[LOGO_FONT_SIZES.length - 1]}px</span>
                  </div>
                </div>
              </SettingItem>
            )}
          </div>
        )}

        {/* STYLING TAB */}
        {activeTab === 'styling' && (
          <div className="space-y-4 mt-4">
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
          </div>
        )}

        {/* OTHER TAB */}
        {activeTab === 'other' && (
          <div className="space-y-4 mt-4">
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
        )}
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
