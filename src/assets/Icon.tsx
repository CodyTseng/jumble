import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'
import LogoLight from './logo-light.svg'
import LogoDark from './logo-dark.svg'

export default function Icon({ className }: { className?: string }) {
  const { theme } = useTheme()

  // Use logo-light for light and white modes, logo-dark for all dark modes and black mode
  const isLight = theme === 'light' || theme === 'white'
  const iconSrc = isLight ? LogoLight : LogoDark

  return (
    <div className={cn("flex items-center justify-center w-12 h-12", className)}>
      <img
        src={iconSrc}
        alt="x21"
        className="w-12 h-12 object-contain"
      />
    </div>
  )
}
