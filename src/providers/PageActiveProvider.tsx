import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

export const PageActiveContext = createContext<boolean | null>(null)

const BrowserActiveContext = createContext(true)

function isBrowserActive() {
  if (typeof document === 'undefined') return true
  return document.visibilityState !== 'hidden'
}

export function PageActiveProvider({ children }: { children: ReactNode }) {
  const [browserActive, setBrowserActive] = useState(isBrowserActive)

  useEffect(() => {
    const activate = () => setBrowserActive(isBrowserActive())
    const deactivate = () => setBrowserActive(false)
    const handleVisibilityChange = () => setBrowserActive(isBrowserActive())

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('resume', activate)
    document.addEventListener('freeze', deactivate)
    window.addEventListener('focus', activate)
    window.addEventListener('online', activate)
    window.addEventListener('pageshow', activate)
    window.addEventListener('blur', deactivate)
    window.addEventListener('offline', deactivate)
    window.addEventListener('pagehide', deactivate)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('resume', activate)
      document.removeEventListener('freeze', deactivate)
      window.removeEventListener('focus', activate)
      window.removeEventListener('online', activate)
      window.removeEventListener('pageshow', activate)
      window.removeEventListener('blur', deactivate)
      window.removeEventListener('offline', deactivate)
      window.removeEventListener('pagehide', deactivate)
    }
  }, [])

  return (
    <BrowserActiveContext.Provider value={browserActive}>{children}</BrowserActiveContext.Provider>
  )
}

export function usePageActive() {
  const pageActive = useContext(PageActiveContext)
  const browserActive = useContext(BrowserActiveContext)
  return (pageActive ?? false) && browserActive
}
