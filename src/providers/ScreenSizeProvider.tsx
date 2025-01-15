import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type TScreenSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

type TScreenSizeContext = {
  screenSize: TScreenSize
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
  const [screenSize, setScreenSize] = useState<TScreenSize>('sm')
  const isSmallScreen = useMemo(() => screenSize === 'sm', [screenSize])
  const isLargeScreen = useMemo(() => ['2xl'].includes(screenSize), [screenSize])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setScreenSize('sm')
      } else if (window.innerWidth < 768) {
        setScreenSize('md')
      } else if (window.innerWidth < 1024) {
        setScreenSize('lg')
      } else if (window.innerWidth < 1280) {
        setScreenSize('xl')
      } else {
        setScreenSize('2xl')
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <ScreenSizeContext.Provider
      value={{
        screenSize,
        isSmallScreen,
        isLargeScreen
      }}
    >
      {children}
    </ScreenSizeContext.Provider>
  )
}
