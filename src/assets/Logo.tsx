import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'
import LogoLight from './logo-light.svg'
import LogoDark from './logo-dark.svg'

export default function Logo({ className }: { className?: string }) {
  const { theme } = useTheme()

  // Use logo-light for light and white modes, logo-dark for all dark modes and black mode
  const isLight = theme === 'light' || theme === 'white'
  const logoSrc = isLight ? LogoLight : LogoDark

  return (
    <img
      src={logoSrc}
      alt="x21"
      className={cn("w-full h-auto max-w-[48px]", className)}
    />
  )
}
