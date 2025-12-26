import { PRIMARY_COLORS, StorageKey, TPrimaryColor } from '@/constants'
import storage from '@/services/local-storage.service'
import { TTheme, TThemeSetting } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'
import communityThemeService from '@/services/community-theme.service'

type ThemeProviderState = {
  themeSetting: TThemeSetting
  setThemeSetting: (themeSetting: TThemeSetting) => void
  primaryColor: TPrimaryColor
  setPrimaryColor: (color: TPrimaryColor) => void
  communityDomain: string | null
  setCommunityDomain: (domain: string | null) => void
  isCommunityThemeLoading: boolean
  communityThemeAvailable: boolean
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

const updateCSSVariables = (color: TPrimaryColor, currentTheme: TTheme) => {
  const root = window.document.documentElement
  const colorConfig = PRIMARY_COLORS[color] ?? PRIMARY_COLORS.DEFAULT

  const config = currentTheme === 'light' ? colorConfig.light : colorConfig.dark

  root.style.setProperty('--primary', config.primary)
  root.style.setProperty('--primary-hover', config['primary-hover'])
  root.style.setProperty('--primary-foreground', config['primary-foreground'])
  root.style.setProperty('--ring', config.ring)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeSetting, setThemeSetting] = useState<TThemeSetting>(
    (localStorage.getItem(StorageKey.THEME_SETTING) as TThemeSetting) ?? 'system'
  )
  const [theme, setTheme] = useState<TTheme>('light')
  const [primaryColor, setPrimaryColor] = useState<TPrimaryColor>(
    (localStorage.getItem(StorageKey.PRIMARY_COLOR) as TPrimaryColor) ?? 'DEFAULT'
  )
  const [communityDomain, setCommunityDomain] = useState<string | null>(
    localStorage.getItem(StorageKey.COMMUNITY_THEME_DOMAIN)
  )
  const [isCommunityThemeLoading, setIsCommunityThemeLoading] = useState(false)
  const [communityThemeAvailable, setCommunityThemeAvailable] = useState(false)
  const [communityThemeSetting, setCommunityThemeSetting] = useState<TThemeSetting | null>(null)
  const [communityPrimaryColor, setCommunityPrimaryColor] = useState<TPrimaryColor | null>(null)

  // Fetch community theme when domain changes
  useEffect(() => {
    const fetchCommunityTheme = async () => {
      if (!communityDomain) {
        setCommunityThemeAvailable(false)
        return
      }

      setIsCommunityThemeLoading(true)
      try {
        const theme = await communityThemeService.fetchCommunityTheme(communityDomain)
        if (theme) {
          setCommunityThemeSetting(theme.themeSetting)
          setCommunityPrimaryColor(theme.primaryColor)
          setCommunityThemeAvailable(true)
        } else {
          setCommunityThemeAvailable(false)
        }
      } catch (error) {
        console.error('[ThemeProvider] Error fetching community theme:', error)
        setCommunityThemeAvailable(false)
      } finally {
        setIsCommunityThemeLoading(false)
      }
    }

    fetchCommunityTheme()
  }, [communityDomain])

  useEffect(() => {
    if (themeSetting === 'community') {
      // Use community theme if available
      if (communityThemeSetting && communityThemeSetting !== 'community') {
        setTheme(communityThemeSetting)
      } else {
        // Fallback to system if community theme not available
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        setTheme(mediaQuery.matches ? 'dark' : 'light')
      }
      return
    }

    if (themeSetting !== 'system') {
      setTheme(themeSetting)
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    setTheme(mediaQuery.matches ? 'dark' : 'light')

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [themeSetting, communityThemeSetting])

  useEffect(() => {
    const updateTheme = async () => {
      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(theme === 'pure-black' ? 'dark' : theme)

      if (theme === 'pure-black') {
        root.classList.add('pure-black')
      } else {
        root.classList.remove('pure-black')
      }
    }
    updateTheme()
  }, [theme])

  useEffect(() => {
    // Use community primary color if theme setting is 'community' and community color is available
    const effectiveColor = (themeSetting === 'community' && communityPrimaryColor)
      ? communityPrimaryColor
      : primaryColor
    updateCSSVariables(effectiveColor, theme)
  }, [theme, primaryColor, themeSetting, communityPrimaryColor])

  const updateThemeSetting = (themeSetting: TThemeSetting) => {
    storage.setThemeSetting(themeSetting)
    setThemeSetting(themeSetting)
  }

  const updatePrimaryColor = (color: TPrimaryColor) => {
    storage.setPrimaryColor(color)
    setPrimaryColor(color)
  }

  const updateCommunityDomain = (domain: string | null) => {
    if (domain) {
      localStorage.setItem(StorageKey.COMMUNITY_THEME_DOMAIN, domain)
    } else {
      localStorage.removeItem(StorageKey.COMMUNITY_THEME_DOMAIN)
    }
    setCommunityDomain(domain)
  }

  return (
    <ThemeProviderContext.Provider
      value={{
        themeSetting,
        setThemeSetting: updateThemeSetting,
        primaryColor,
        setPrimaryColor: updatePrimaryColor,
        communityDomain,
        setCommunityDomain: updateCommunityDomain,
        isCommunityThemeLoading,
        communityThemeAvailable
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
