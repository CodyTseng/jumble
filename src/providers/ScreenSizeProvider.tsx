import { getScreenSize, observeScreenSize } from '@/lib/responsive-screen'
import { createContext, useContext, useEffect, useState } from 'react'

/** Responsive layout breakpoints only; do not use these as OS or input-mode checks. */
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
  const [size, setSize] = useState(getScreenSize)

  useEffect(
    () =>
      observeScreenSize((next) => {
        setSize((previous) =>
          previous.isSmallScreen === next.isSmallScreen &&
          previous.isLargeScreen === next.isLargeScreen
            ? previous
            : next
        )
      }),
    []
  )

  return <ScreenSizeContext.Provider value={size}>{children}</ScreenSizeContext.Provider>
}
