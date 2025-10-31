import storage from '@/services/local-storage.service'
import { TLogoStyle } from '@/types'
import { createContext, useContext, useState } from 'react'

type TLogoStyleContext = {
  logoStyle: TLogoStyle
  setLogoStyle: (style: TLogoStyle) => void
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

  const setLogoStyle = (style: TLogoStyle) => {
    setLogoStyleState(style)
    storage.setLogoStyle(style)
  }

  return (
    <LogoStyleContext.Provider
      value={{
        logoStyle,
        setLogoStyle
      }}
    >
      {children}
    </LogoStyleContext.Provider>
  )
}
