import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRTL } from '@/i18n'

export function RTLProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()

  useEffect(() => {
    const updateDirection = () => {
      const currentLanguage = i18n.language
      const direction = isRTL(currentLanguage) ? 'rtl' : 'ltr'

      // Update HTML element attributes
      document.documentElement.dir = direction
      document.documentElement.lang = currentLanguage
    }

    // Set initial direction
    updateDirection()

    // Listen for language changes
    i18n.on('languageChanged', updateDirection)

    return () => {
      i18n.off('languageChanged', updateDirection)
    }
  }, [i18n])

  return <>{children}</>
}
