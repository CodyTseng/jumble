import { useTheme } from '@/providers/ThemeProvider'
import logoDark from './logo-dark.svg'
import logoLight from './logo-light.svg'

export default function Logo({ className }: { className?: string }) {
  const { theme } = useTheme()
  
  return (
    <img 
      src={theme === 'dark' ? logoDark : logoLight} 
      alt="Jumblekat Logo" 
      className={className}
    />
  )
}
