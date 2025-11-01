import storage from '@/services/local-storage.service'
import { TLogoStyle } from '@/types'
import { createContext, useContext, useState } from 'react'

type TLogoStyleContext = {
  logoStyle: TLogoStyle
  setLogoStyle: (style: TLogoStyle) => void
  customLogoText: string
  setCustomLogoText: (text: string) => void
}

const LogoStyleContext = createContext<TLogoStyleContext | undefined>(undefined)

export const useLogoStyle = () => {
  const context = useContext(LogoStyleContext)
  if (!context) {
    throw new Error('useLogoStyle must be used within a LogoStyleProvider')
  }
  return context
}

export function LogoStyleProvider({ children }: { children: React.ReactNode }) {
  const [logoStyle, setLogoStyleState] = useState(storage.getLogoStyle())
  const [customLogoText, setCustomLogoTextState] = useState(storage.getCustomLogoText())

  const setLogoStyle = (style: TLogoStyle) => {
    setLogoStyleState(style)
    storage.setLogoStyle(style)
  }

  const setCustomLogoText = (text: string) => {
    setCustomLogoTextState(text)
    storage.setCustomLogoText(text)
  }

  return (
    <LogoStyleContext.Provider
      value={{
        logoStyle,
        setLogoStyle,
        customLogoText,
        setCustomLogoText
      }}
    >
      {children}
    </LogoStyleContext.Provider>
  )
}
