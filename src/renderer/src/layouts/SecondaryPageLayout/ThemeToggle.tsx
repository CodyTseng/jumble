import { useTheme } from '@renderer/components/theme-provider'
import { TitlebarButton } from '@renderer/components/Titlebar'
import { Moon, Sun, SunMoon } from 'lucide-react'

export default function ThemeToggle() {
  const { themeSetting, setThemeSetting } = useTheme()

  return (
    <>
      {themeSetting === 'system' ? (
        <TitlebarButton onClick={() => setThemeSetting('light')} title="switch to light theme">
          <SunMoon />
        </TitlebarButton>
      ) : themeSetting === 'light' ? (
        <TitlebarButton onClick={() => setThemeSetting('dark')} title="switch to dark theme">
          <Sun />
        </TitlebarButton>
      ) : (
        <TitlebarButton onClick={() => setThemeSetting('system')} title="switch to system theme">
          <Moon />
        </TitlebarButton>
      )}
    </>
  )
}
