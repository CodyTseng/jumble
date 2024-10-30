import { createContext, useContext, useEffect, useState } from 'react'
import { TTheme, TThemeSetting } from '@common/types'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: TTheme
}

type ThemeProviderState = {
  themeSetting: TThemeSetting
  setThemeSetting: (themeSetting: TThemeSetting) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [themeSetting, setThemeSetting] = useState<TThemeSetting>(
    (localStorage.getItem('themeSetting') as TTheme) ?? 'system'
  )
  const [theme, setTheme] = useState<TTheme>('light')

  const init = async () => {
    const [themeSetting, theme] = await Promise.all([
      window.api.theme.themeSetting(),
      window.api.theme.current()
    ])
    localStorage.setItem('theme', theme)
    setTheme(theme)
    setThemeSetting(themeSetting)

    window.api.theme.onChange((theme) => {
      localStorage.setItem('theme', theme)
      setTheme(theme)
    })
  }

  useEffect(() => {
    init()
  }, [])

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
    setThemeSetting: (themeSetting: TThemeSetting) => {
      window.api.theme.set(themeSetting).then(() => setThemeSetting(themeSetting))
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
