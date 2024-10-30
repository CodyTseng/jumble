import { useTheme } from '@renderer/components/theme-provider'
import { TitlebarButton } from '@renderer/components/Titlebar'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      {theme === 'light' ? (
        <TitlebarButton onClick={() => setTheme('dark')} title="Switch to dark theme">
          <Sun />
        </TitlebarButton>
      ) : (
        <TitlebarButton onClick={() => setTheme('light')} title="Switch to light theme">
          <Moon />
        </TitlebarButton>
      )}
    </>
  )
}
