import { PRIMARY_COLORS, StorageKey, TPrimaryColor } from '@/constants'
import storage from '@/services/local-storage.service'
import { TTheme, TThemeSetting } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'

type ThemeProviderState = {
  themeSetting: TThemeSetting
  setThemeSetting: (themeSetting: TThemeSetting) => void
  primaryColor: TPrimaryColor
  setPrimaryColor: (color: TPrimaryColor) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

const updateCSSVariables = (color: TPrimaryColor, currentTheme: TTheme) => {
  const root = window.document.documentElement
  const colorConfig = PRIMARY_COLORS[color] ?? PRIMARY_COLORS.DEFAULT

  const config = currentTheme === 'light' ? colorConfig.light : colorConfig.dark

  root.style.setProperty('--primary', config.primary)
  root.style.setProperty('--primary-hover', config['primary-hover'])
  root.style.setProperty('--primary-foreground', config['primary-foreground'])
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeSetting, setThemeSetting] = useState<TThemeSetting>(
    (localStorage.getItem(StorageKey.THEME_SETTING) as TThemeSetting) ?? 'system'
  )
  const [theme, setTheme] = useState<TTheme>('light')
  const [primaryColor, setPrimaryColor] = useState<TPrimaryColor>(
    (localStorage.getItem(StorageKey.PRIMARY_COLOR) as TPrimaryColor) ?? 'DEFAULT'
  )

  useEffect(() => {
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
  }, [themeSetting])

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
    updateCSSVariables(primaryColor, theme)
  }, [theme, primaryColor])

  const updateThemeSetting = (themeSetting: TThemeSetting) => {
    storage.setThemeSetting(themeSetting)
    setThemeSetting(themeSetting)
  }

  const updatePrimaryColor = (color: TPrimaryColor) => {
    storage.setPrimaryColor(color)
    setPrimaryColor(color)
  }

  return (
    <ThemeProviderContext.Provider
      value={{
        themeSetting,
        setThemeSetting: updateThemeSetting,
        primaryColor,
        setPrimaryColor: updatePrimaryColor
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
