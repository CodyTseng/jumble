import { createContext, useContext, useMemo } from 'react'

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
  const isSmallScreen = useMemo(() => window.innerWidth < 640, [])
  const isLargeScreen = useMemo(() => window.innerWidth >= 1280, [])

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
