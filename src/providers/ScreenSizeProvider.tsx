import { isElectron } from '@/lib/platform'
import { createContext, useContext, useEffect, useState } from 'react'

type TScreenSizeContext = {
  isSmallScreen: boolean
  isLargeScreen: boolean
}

const ScreenSizeContext = createContext<TScreenSizeContext | undefined>(undefined)

export const useScreenSize = () => {
  const context = useContext(ScreenSizeContext)
  if (!context) {
    throw new Error('useScreenSize must be used within a ScreenSizeProvider')
  }
  return context
}

export function ScreenSizeProvider({ children }: { children: React.ReactNode }) {
  const [isSmallScreen, setIsSmallScreen] = useState(() => window.innerWidth <= 768)
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 1280)

  useEffect(() => {
    if (!isElectron()) return
    const onResize = () => {
      setIsSmallScreen(window.innerWidth <= 768)
      setIsLargeScreen(window.innerWidth >= 1280)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <ScreenSizeContext.Provider
      value={{
        isSmallScreen,
        isLargeScreen
      }}
    >
      {children}
    </ScreenSizeContext.Provider>
  )
}
