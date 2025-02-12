import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TZapContext = {
  defaultZapSats: number
  updateDefaultSats: (sats: number) => void
}

const ZapContext = createContext<TZapContext | undefined>(undefined)

export const useZap = () => {
  const context = useContext(ZapContext)
  if (!context) {
    throw new Error('useZap must be used within a ZapProvider')
  }
  return context
}

export function ZapProvider({ children }: { children: React.ReactNode }) {
  const [defaultZapSats, setDefaultZapSats] = useState<number>(storage.getDefaultZapSats())

  const updateDefaultSats = (sats: number) => {
    storage.setDefaultZapSats(sats)
    setDefaultZapSats(sats)
  }

  return (
    <ZapContext.Provider value={{ defaultZapSats, updateDefaultSats }}>
      {children}
    </ZapContext.Provider>
  )
}
