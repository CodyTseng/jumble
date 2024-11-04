import { Button } from '@renderer/components/ui/button'
import { useTheme } from '@renderer/providers/ThemeProvider'
import { Moon, Sun, SunMoon } from 'lucide-react'

export default function ThemeToggle() {
  const { themeSetting, setThemeSetting } = useTheme()

  return (
    <>
      {themeSetting === 'system' ? (
        <Button
          variant="titlebar"
          size="titlebar"
          onClick={() => setThemeSetting('light')}
          title="switch to light theme"
        >
          <SunMoon />
        </Button>
      ) : themeSetting === 'light' ? (
        <Button
          variant="titlebar"
          size="titlebar"
          onClick={() => setThemeSetting('dark')}
          title="switch to dark theme"
        >
          <Sun />
        </Button>
      ) : (
        <Button
          variant="titlebar"
          size="titlebar"
          onClick={() => setThemeSetting('system')}
          title="switch to system theme"
        >
          <Moon />
        </Button>
      )}
    </>
  )
}
