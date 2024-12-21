import { createContext, useContext, useEffect, useState } from 'react'

type TChristmasContext = {
  enabled: boolean
  toggle: () => void
}

const ChristmasContext = createContext<TChristmasContext | undefined>(undefined)

export const useChristmas = () => {
  const context = useContext(ChristmasContext)
  if (!context) {
    throw new Error('useChristmas must be used within a ChristmasProvider')
  }
  return context
}

export function ChristmasProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    localStorage.getItem('christmasEnabled') !== 'false' && setEnabled(true)
  }, [])

  const toggle = () => {
    setEnabled((prev) => {
      localStorage.setItem('christmasEnabled', String(!prev))
      return !prev
    })
  }

  return (
    <ChristmasContext.Provider value={{ enabled, toggle }}>{children}</ChristmasContext.Provider>
  )
}
