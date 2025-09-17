import storage from '@/services/local-storage.service'
import { onConnected, onDisconnected } from '@getalby/bitcoin-connect-react'
import { createContext, useContext, useEffect, useState } from 'react'
import lightningService from '@/services/lightning.service'

type TZapContext = {
  isWalletConnected: boolean
  defaultZapSats: number
  updateDefaultSats: (sats: number) => void
  defaultZapComment: string
  updateDefaultComment: (comment: string) => void
  quickZap: boolean
  updateQuickZap: (quickZap: boolean) => void
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
  const [quickZap, setQuickZap] = useState<boolean>(storage.getQuickZap())
  const [isWalletConnected, setIsWalletConnected] = useState(false)

  useEffect(() => {
    const unSubOnConnected = onConnected((provider) => {
      setIsWalletConnected(true)
      lightningService.provider = provider
    })
    const unSubOnDisconnected = onDisconnected(() => {
      setIsWalletConnected(false)
      lightningService.provider = null
    })

    return () => {
      unSubOnConnected()
      unSubOnDisconnected()
    }
  }, [])

  const updateDefaultSats = (sats: number) => {
    storage.setDefaultZapSats(sats)
    setDefaultZapSats(sats)
  }

  const updateDefaultComment = (comment: string) => {
    storage.setDefaultZapComment(comment)
    setDefaultZapComment(comment)
  }

  const updateQuickZap = (quickZap: boolean) => {
    storage.setQuickZap(quickZap)
    setQuickZap(quickZap)
  }

  return (
    <ZapContext.Provider
      value={{
        isWalletConnected,
        defaultZapSats,
        updateDefaultSats,
        defaultZapComment,
        updateDefaultComment,
        quickZap,
        updateQuickZap
      }}
    >
      {children}
    </ZapContext.Provider>
  )
}
