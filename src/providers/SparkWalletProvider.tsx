import { useNostr } from '@/providers/NostrProvider'
import sparkService from '@/services/spark.service'
import sparkStorage from '@/services/spark-storage.service'
import sparkProfileSync from '@/services/spark-profile-sync.service'
import sparkZapReceipt from '@/services/spark-zap-receipt.service'
import { createContext, useContext, useEffect, useState } from 'react'

type TSparkWalletContext = {
  connected: boolean
  connecting: boolean
  balance: number | null
  lightningAddress: string | null
  refreshWalletState: () => Promise<void>
  deleteWallet: () => Promise<void>
}

const SparkWalletContext = createContext<TSparkWalletContext | undefined>(undefined)

export const useSparkWallet = () => {
  const context = useContext(SparkWalletContext)
  if (!context) {
    throw new Error('useSparkWallet must be used within a SparkWalletProvider')
  }
  return context
}

export function SparkWalletProvider({ children }: { children: React.ReactNode}) {
  const { pubkey, profileEvent, publish, updateProfileEvent } = useNostr()
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [lightningAddress, setLightningAddress] = useState<string | null>(null)

  // Auto-connect Spark wallet when user is logged in
  useEffect(() => {
    if (!pubkey) {
      // User logged out, disconnect Spark wallet
      if (sparkService.isConnected()) {
        console.log('[SparkWalletProvider] User logged out, disconnecting Spark wallet')
        sparkService.disconnect()
        setConnected(false)
        setBalance(null)
        setLightningAddress(null)
      }
      return
    }

    // Check if user has a saved wallet
    const hasSavedWallet = sparkStorage.hasMnemonic(pubkey)
    if (!hasSavedWallet) {
      console.log('[SparkWalletProvider] No saved wallet found for user')
      return
    }

    // If already connected, update state and don't reconnect
    if (sparkService.isConnected()) {
      console.log('[SparkWalletProvider] Spark wallet already connected, updating state...')
      if (!connected) {
        setConnected(true)
        // Fetch wallet info
        sparkService
          .getInfo(false)
          .then((info) => {
            setBalance(info.balanceSats)
            console.log('[SparkWalletProvider] State synced with existing connection')
          })
          .catch((err) => console.error('[SparkWalletProvider] Failed to get info:', err))

        // Fetch Lightning address
        sparkService
          .getLightningAddress()
          .then((addr) => {
            setLightningAddress(addr?.lightningAddress || null)
          })
          .catch((err) => console.error('[SparkWalletProvider] Failed to get address:', err))
      }
      return
    }

    // Auto-connect the wallet with timeout
    const autoConnect = async () => {
      if (connecting) {
        console.log('[SparkWalletProvider] Already connecting, skipping...')
        return
      }

      // Set a timeout to prevent hanging forever
      const timeoutId = setTimeout(() => {
        console.error('[SparkWalletProvider] Auto-connect timeout after 30 seconds')
        setConnecting(false)
      }, 30000) // 30 second timeout

      try {
        setConnecting(true)
        console.log('[SparkWalletProvider] Auto-connecting Spark wallet...')

        // Load and decrypt mnemonic
        console.log('[SparkWalletProvider] Loading encrypted mnemonic...')
        const mnemonic = await sparkStorage.loadMnemonic(pubkey)
        if (!mnemonic) {
          console.error('[SparkWalletProvider] No mnemonic found or failed to decrypt')
          clearTimeout(timeoutId)
          return
        }
        console.log('[SparkWalletProvider] Mnemonic loaded and decrypted successfully')

        // Get API key
        const apiKey = import.meta.env.VITE_BREEZ_SPARK_API_KEY
        if (!apiKey) {
          console.error('[SparkWalletProvider] No API key found')
          clearTimeout(timeoutId)
          return
        }

        // Connect to Spark (this will initialize WASM automatically if needed)
        console.log('[SparkWalletProvider] Connecting to Spark SDK...')
        const { sdk } = await sparkService.connect(apiKey, mnemonic, 'mainnet')
        console.log('[SparkWalletProvider] ✅ Spark SDK connected')

        setConnected(true)

        // Get wallet info
        console.log('[SparkWalletProvider] Getting wallet info...')
        const info = await sparkService.getInfo(true)
        setBalance(info.balanceSats)

        // Get Lightning address
        console.log('[SparkWalletProvider] Getting Lightning address...')
        const address = await sparkService.getLightningAddress()
        setLightningAddress(address?.lightningAddress || null)

        console.log('[SparkWalletProvider] ✅ Wallet auto-connected successfully')
        console.log('[SparkWalletProvider] Balance:', info.balanceSats, 'sats')
        console.log('[SparkWalletProvider] Lightning address:', address?.lightningAddress)

        // NOTE: Auto-sync disabled until Breez adds NIP-57 support
        // The Breez Lightning address works for regular payments but does not support
        // Nostr zaps because the LNURL endpoint is missing required NIP-57 fields:
        // - allowsNostr: true
        // - nostrPubkey: <hex-pubkey>
        //
        // Regular Lightning payments to daniel@breez.tips work fine, but NIP-57 compliant
        // wallets reject zap attempts with "invalid lightning address" error.
        //
        // Feature request submitted to Breez SDK team.
        // TODO: Re-enable auto-sync once Breez adds NIP-57 support
        //
        // Auto-sync Lightning address to Nostr profile if needed
        // if (address?.lightningAddress && profileEvent && publish && updateProfileEvent) {
        //   try {
        //     const profileContent = JSON.parse(profileEvent.content)
        //     if (profileContent.lud16 !== address.lightningAddress) {
        //       console.log('[SparkWalletProvider] Auto-syncing Lightning address to Nostr profile...')
        //       await sparkProfileSync.syncLightningAddressToProfile(
        //         address.lightningAddress,
        //         profileEvent,
        //         publish,
        //         updateProfileEvent
        //       )
        //       console.log('[SparkWalletProvider] ✅ Lightning address synced to profile')
        //     } else {
        //       console.log('[SparkWalletProvider] Lightning address already in profile')
        //     }
        //   } catch (error) {
        //     console.error('[SparkWalletProvider] Failed to auto-sync Lightning address:', error)
        //     // Non-critical error, don't throw
        //   }
        // }

        clearTimeout(timeoutId)
      } catch (error) {
        console.error('[SparkWalletProvider] ❌ Auto-connect failed:', error)
        console.error('[SparkWalletProvider] Error details:', error instanceof Error ? error.message : String(error))
        setConnected(false)
        clearTimeout(timeoutId)
      } finally {
        setConnecting(false)
      }
    }

    autoConnect()
  }, [pubkey])

  // Listen for balance updates and publish zap receipts for incoming payments
  useEffect(() => {
    if (!connected) return

    const unsubscribe = sparkService.onEvent(async (event) => {
      if (event.type === 'paymentSucceeded' || event.type === 'synced') {
        try {
          const info = await sparkService.getInfo(false)
          setBalance(info.balanceSats)
          console.log('[SparkWalletProvider] Balance updated:', info.balanceSats, 'sats')

          // If this is an incoming payment (received), publish zap receipt
          if (event.type === 'paymentSucceeded' && event.payment) {
            const payment = event.payment
            const isReceived = payment.paymentType === 'receive'

            if (isReceived && publish) {
              console.log('[SparkWalletProvider] Incoming payment received, checking for zap...')
              console.log('[SparkWalletProvider] Payment object:', JSON.stringify(payment, null, 2))

              // Check if this is a zap payment (has zap request in description)
              if (sparkZapReceipt.isZapPayment(payment)) {
                console.log('[SparkWalletProvider] This is a zap! Publishing zap receipt...')
                await sparkZapReceipt.publishZapReceipt(payment, publish)
              } else {
                console.log('[SparkWalletProvider] Regular payment, not a zap')
                console.log('[SparkWalletProvider] Payment description:', payment.description)
              }
            }
          }
        } catch (error) {
          console.error('[SparkWalletProvider] Failed to update balance:', error)
        }
      }
    })

    return () => unsubscribe()
  }, [connected, publish])

  // Refresh wallet state (balance and Lightning address)
  const refreshWalletState = async () => {
    if (!sparkService.isConnected()) {
      console.log('[SparkWalletProvider] Cannot refresh - wallet not connected')
      return
    }

    try {
      // Update connected state if not already set
      if (!connected) {
        console.log('[SparkWalletProvider] Updating connected state to true')
        setConnected(true)
      }

      const info = await sparkService.getInfo(false)
      setBalance(info.balanceSats)
      console.log('[SparkWalletProvider] Balance updated:', info.balanceSats, 'sats')

      const address = await sparkService.getLightningAddress()
      setLightningAddress(address?.lightningAddress || null)
      console.log('[SparkWalletProvider] Lightning address:', address?.lightningAddress || 'not registered')

      console.log('[SparkWalletProvider] Wallet state refreshed')
    } catch (error) {
      console.error('[SparkWalletProvider] Failed to refresh wallet state:', error)
    }
  }

  // Delete wallet from storage and disconnect
  const deleteWallet = async () => {
    if (!pubkey) {
      console.error('[SparkWalletProvider] Cannot delete wallet - no pubkey')
      return
    }

    try {
      console.log('[SparkWalletProvider] Deleting wallet...')

      // Disconnect from Spark SDK
      await sparkService.disconnect()

      // Delete encrypted mnemonic from storage
      sparkStorage.deleteMnemonic(pubkey)

      // Reset state
      setConnected(false)
      setBalance(null)
      setLightningAddress(null)

      console.log('[SparkWalletProvider] ✅ Wallet deleted successfully')
    } catch (error) {
      console.error('[SparkWalletProvider] ❌ Failed to delete wallet:', error)
      throw error
    }
  }

  return (
    <SparkWalletContext.Provider
      value={{
        connected,
        connecting,
        balance,
        lightningAddress,
        refreshWalletState,
        deleteWallet
      }}
    >
      {children}
    </SparkWalletContext.Provider>
  )
}
