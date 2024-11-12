import { createContext, useContext, useEffect, useState } from 'react'
import { TTheme, TThemeSetting } from '@common/types'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: TTheme
}

type ThemeProviderState = {
  themeSetting: TThemeSetting
  setThemeSetting: (themeSetting: TThemeSetting) => Promise<void>
}

// web only
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [themeSetting, setThemeSetting] = useState<TThemeSetting>('system')
  const [theme, setTheme] = useState<TTheme>('light')

  useEffect(() => {
    const init = async () => {
      // electron
      if (window.api) {
        const [themeSetting, theme] = await Promise.all([
          window.api.theme.themeSetting(),
          window.api.theme.current()
        ])
        setTheme(theme)
        setThemeSetting(themeSetting)

        window.api.theme.onChange((theme) => {
          setTheme(theme)
        })
      } else {
        // web
        const themeSetting =
          (localStorage.getItem('themeSetting') as TThemeSetting | null) ?? 'system'
        setThemeSetting(themeSetting)
        if (themeSetting === 'system') {
          setTheme(getSystemTheme())
          return
        }
        setTheme(themeSetting)
      }
    }

    init()
  }, [])

  useEffect(() => {
    if (themeSetting !== 'system' || window.api) return

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
      root.classList.add(theme)
      localStorage.setItem('theme', theme)
    }
    updateTheme()
  }, [theme])

  const value = {
    themeSetting: themeSetting,
    setThemeSetting: async (themeSetting: TThemeSetting) => {
      if (window.api) {
        await window.api.theme.set(themeSetting)
      } else {
        localStorage.setItem('themeSetting', themeSetting)
      }
      setThemeSetting(themeSetting)
      if (themeSetting === 'system') {
        setTheme(getSystemTheme())
        return
      }
      setTheme(themeSetting)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
