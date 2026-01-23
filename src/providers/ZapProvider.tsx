import lightningService from '@/services/lightning.service'
import storage from '@/services/local-storage.service'
import sparkService from '@/services/spark.service'
import { onConnected, onDisconnected } from '@getalby/bitcoin-connect-react'
import { GetInfoResponse as WebLNGetInfoResponse, WebLNProvider } from '@webbtc/webln-types'
import { GetInfoResponse as SparkGetInfoResponse } from '@breeztech/breez-sdk-spark/web'
import { createContext, useContext, useEffect, useState } from 'react'

type TZapContext = {
  // External wallet (WebLN)
  isWalletConnected: boolean
  provider: WebLNProvider | null
  walletInfo: WebLNGetInfoResponse | null

  // Spark wallet
  isSparkConnected: boolean
  sparkWalletInfo: SparkGetInfoResponse | null
  sparkLightningAddress: string | null

  // Zap settings
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

  // External wallet (WebLN) state
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [provider, setProvider] = useState<WebLNProvider | null>(null)
  const [walletInfo, setWalletInfo] = useState<WebLNGetInfoResponse | null>(null)

  // Spark wallet state
  const [isSparkConnected, setIsSparkConnected] = useState(false)
  const [sparkWalletInfo, setSparkWalletInfo] = useState<SparkGetInfoResponse | null>(null)
  const [sparkLightningAddress, setSparkLightningAddress] = useState<string | null>(null)

  // Listen to external wallet (WebLN) connections
  useEffect(() => {
    const unSubOnConnected = onConnected((provider) => {
      setIsWalletConnected(true)
      setWalletInfo(null)
      setProvider(provider)
      lightningService.provider = provider
      provider.getInfo().then(setWalletInfo)
    })
    const unSubOnDisconnected = onDisconnected(() => {
      setIsWalletConnected(false)
      setProvider(null)
      lightningService.provider = null
    })

    return () => {
      unSubOnConnected()
      unSubOnDisconnected()
    }
  }, [])

  // Listen to Spark wallet connection status
  useEffect(() => {
    const checkSparkConnection = async () => {
      if (sparkService.isConnected()) {
        setIsSparkConnected(true)
        try {
          const info = await sparkService.getInfo(false)
          setSparkWalletInfo(info)

          const addr = await sparkService.getLightningAddress()
          setSparkLightningAddress(addr?.lightningAddress || null)
        } catch (error) {
          console.error('[ZapProvider] Failed to get Spark wallet info:', error)
        }
      }
    }

    checkSparkConnection()

    // Listen to Spark SDK events for balance updates
    const unsubscribe = sparkService.onEvent(async (event) => {
      if (event.type === 'paymentSucceeded' || event.type === 'synced') {
        try {
          const info = await sparkService.getInfo(false)
          setSparkWalletInfo(info)
        } catch (error) {
          console.error('[ZapProvider] Failed to update Spark balance:', error)
        }
      }
    })

    return unsubscribe
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
        // External wallet (WebLN)
        isWalletConnected,
        provider,
        walletInfo,

        // Spark wallet
        isSparkConnected,
        sparkWalletInfo,
        sparkLightningAddress,

        // Zap settings
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
