import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TLogoFontSizeContext = {
  logoFontSize: number
  setLogoFontSize: (size: number) => void
}

const LogoFontSizeContext = createContext<TLogoFontSizeContext | undefined>(undefined)

export const useLogoFontSize = () => {
  const context = useContext(LogoFontSizeContext)
  if (!context) {
    throw new Error('useLogoFontSize must be used within a LogoFontSizeProvider')
  }
  return context
}

export function LogoFontSizeProvider({ children }: { children: React.ReactNode }) {
  const [logoFontSize, setLogoFontSizeState] = useState(storage.getLogoFontSize())

  const setLogoFontSize = (size: number) => {
    setLogoFontSizeState(size)
    storage.setLogoFontSize(size)
  }

  return (
    <LogoFontSizeContext.Provider
      value={{
        logoFontSize,
        setLogoFontSize
      }}
    >
      {children}
    </LogoFontSizeContext.Provider>
  )
}
