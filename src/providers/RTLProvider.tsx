import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRTLLanguage, TLanguage } from '@/i18n'
import { localStorageService } from '@/services/local-storage.service'

type RTLContextType = {
  isRTL: boolean
  toggleRTL: () => void
  showRTLToggle: boolean
}

const RTLContext = createContext<RTLContextType | undefined>(undefined)

export const RTLProvider = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation()
  const currentLanguage = i18n.language as TLanguage
  const showRTLToggle = isRTLLanguage(currentLanguage)

  // Initialize RTL state based on language or stored preference
  const [isRTL, setIsRTL] = useState<boolean>(() => {
    const stored = localStorageService.getItem('rtl-enabled')
    if (stored !== null) {
      return stored === 'true'
    }
    // Default to RTL for RTL languages
    return isRTLLanguage(currentLanguage)
  })

  // Update RTL when language changes
  useEffect(() => {
    const stored = localStorageService.getItem('rtl-enabled')
    if (stored !== null) {
      // User has explicitly set a preference
      setIsRTL(stored === 'true')
    } else {
      // Auto-detect based on language
      setIsRTL(isRTLLanguage(currentLanguage))
    }
  }, [currentLanguage])

  // Apply dir attribute to document
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
  }, [isRTL])

  const toggleRTL = () => {
    const newValue = !isRTL
    setIsRTL(newValue)
    localStorageService.setItem('rtl-enabled', newValue.toString())
  }

  return (
    <RTLContext.Provider value={{ isRTL, toggleRTL, showRTLToggle }}>
      {children}
    </RTLContext.Provider>
  )
}

export const useRTL = () => {
  const context = useContext(RTLContext)
  if (context === undefined) {
    throw new Error('useRTL must be used within RTLProvider')
  }
  return context
}
