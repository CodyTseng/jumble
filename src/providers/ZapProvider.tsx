import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TZapContext = {
  defaultZapSats: number
  updateDefaultSats: (sats: number) => void
  defaultZapComment: string
  updateDefaultComment: (comment: string) => void
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
  const [defaultZapComment, setDefaultZapComment] = useState<string>(storage.getDefaultZapComment())

  const updateDefaultSats = (sats: number) => {
    storage.setDefaultZapSats(sats)
    setDefaultZapSats(sats)
  }

  const updateDefaultComment = (comment: string) => {
    storage.setDefaultZapComment(comment)
    setDefaultZapComment(comment)
  }

  return (
    <ZapContext.Provider
      value={{ defaultZapSats, updateDefaultSats, defaultZapComment, updateDefaultComment }}
    >
      {children}
    </ZapContext.Provider>
  )
}
