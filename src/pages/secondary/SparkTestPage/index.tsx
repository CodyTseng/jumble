import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import sparkService from '@/services/spark.service'
import sparkStorage from '@/services/spark-storage.service'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * SparkTestPage - POC Test Page for Breez Spark SDK
 *
 * This page tests basic Spark SDK functionality:
 * - SDK initialization
 * - Wallet connection
 * - Balance retrieval
 * - Invoice generation
 * - Payment sending
 */
const SparkTestPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { pubkey } = useNostr()
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_BREEZ_SPARK_API_KEY || '')
  const [mnemonic, setMnemonic] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [lightningAddress, setLightningAddress] = useState('')
  const [invoice, setInvoice] = useState('')
  const [paymentRequest, setPaymentRequest] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasSavedWallet, setHasSavedWallet] = useState(false)

  // Check for saved wallet on mount
  useEffect(() => {
    if (!pubkey) return

    const checkSavedWallet = async () => {
      const hasSaved = sparkStorage.hasMnemonic(pubkey)
      setHasSavedWallet(hasSaved)

      if (hasSaved) {
        console.log('[SparkTestPage] Found saved wallet, auto-connecting...')
        await autoConnect()
      }
    }

    checkSavedWallet()
  }, [pubkey])

  // Auto-refresh balance when payment events occur
  useEffect(() => {
    if (!connected) return

    const unsubscribe = sparkService.onEvent(async (event) => {
      console.log('[SparkTestPage] Received event:', event.type)

      if (event.type === 'paymentSucceeded' || event.type === 'synced') {
        // Refresh balance
        try {
          const info = await sparkService.getInfo(false) // Don't force sync, just get current balance
          setBalance(info.balanceSats)

          if (event.type === 'paymentSucceeded') {
            toast.success('Payment received! Balance updated')
          }
        } catch (error) {
          console.error('Failed to update balance:', error)
        }
      }
    })

    return unsubscribe
  }, [connected])

  const autoConnect = async () => {
    if (!pubkey) {
      toast.error('Please sign in with Nostr first')
      return
    }

    setConnecting(true)
    try {
      // Load encrypted mnemonic
      const savedMnemonic = await sparkStorage.loadMnemonic(pubkey)
      if (!savedMnemonic) {
        toast.error('No saved wallet found')
        setHasSavedWallet(false)
        return
      }

      // Connect with saved mnemonic
      const result = await sparkService.connect(apiKey, savedMnemonic, 'mainnet')
      setConnected(true)

      // Get initial info
      const info = await sparkService.getInfo()
      setBalance(info.balanceSats)

      // Try to get Lightning address
      const addr = await sparkService.getLightningAddress()
      if (addr) {
        setLightningAddress(addr.lightningAddress)
      }

      toast.success('Wallet restored from encrypted storage')
    } catch (error) {
      console.error('Auto-connect error:', error)
      toast.error(`Failed to restore wallet: ${(error as Error).message}`)
      setHasSavedWallet(false)
    } finally {
      setConnecting(false)
    }
  }

  const handleConnect = async () => {
    if (!apiKey) {
      toast.error('API Key is required')
      return
    }

    if (!pubkey) {
      toast.error('Please sign in with Nostr first')
      return
    }

    setConnecting(true)
    try {
      const result = await sparkService.connect(apiKey, mnemonic || undefined, 'mainnet')

      if (result.mnemonic) {
        setGeneratedMnemonic(result.mnemonic)
      }

      setConnected(true)

      // Save encrypted mnemonic
      await sparkStorage.saveMnemonic(pubkey, result.mnemonic)
      setHasSavedWallet(true)
      toast.success('Wallet connected & encrypted mnemonic saved!')

      // Get initial info
      const info = await sparkService.getInfo()
      setBalance(info.balanceSats)

      // Try to get Lightning address
      const addr = await sparkService.getLightningAddress()
      if (addr) {
        setLightningAddress(addr.lightningAddress)
      }

      // Hide mnemonic input after successful connection
      setShowMnemonic(false)
      setMnemonic('')
    } catch (error) {
      console.error('Connection error:', error)
      toast.error(`Connection failed: ${(error as Error).message}`)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await sparkService.disconnect()
      setConnected(false)
      setBalance(null)
      setLightningAddress('')
      setGeneratedMnemonic('')
      toast.success('Disconnected (mnemonic still saved)')
    } catch (error) {
      toast.error(`Disconnect failed: ${(error as Error).message}`)
    }
  }

  const handleDeleteWallet = async () => {
    if (!pubkey) return

    if (!confirm('Are you sure you want to delete your saved wallet? This cannot be undone!')) {
      return
    }

    try {
      await sparkService.disconnect()
      sparkStorage.deleteMnemonic(pubkey)
      setConnected(false)
      setBalance(null)
      setLightningAddress('')
      setGeneratedMnemonic('')
      setHasSavedWallet(false)
      toast.success('Wallet deleted from storage')
    } catch (error) {
      toast.error(`Failed to delete wallet: ${(error as Error).message}`)
    }
  }

  const handleRefreshBalance = async () => {
    setLoading(true)
    try {
      console.log('[SparkTestPage] Manual sync & refresh...')
      await sparkService.syncWallet()
      const info = await sparkService.getInfo(false)
      setBalance(info.balanceSats)
      toast.success(`Balance synced: ${info.balanceSats} sats`)
    } catch (error) {
      toast.error(`Failed to refresh: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateInvoice = async () => {
    setLoading(true)
    try {
      const response = await sparkService.receivePayment(1000, 'Juicebox test payment')
      setInvoice(response.paymentRequest)
      toast.success('Invoice generated')
    } catch (error) {
      toast.error(`Invoice generation failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendPayment = async () => {
    if (!paymentRequest) {
      toast.error('Payment request is required')
      return
    }

    setLoading(true)
    try {
      await sparkService.sendPayment(paymentRequest)
      toast.success('Payment sent successfully')

      // Refresh balance
      const info = await sparkService.getInfo()
      setBalance(info.balanceSats)
      setPaymentRequest('')
    } catch (error) {
      toast.error(`Payment failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title="Spark SDK Test (POC)">
      <div className="px-4 pt-3 space-y-6">
        {!pubkey && (
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg">
            <p className="text-sm text-yellow-900 dark:text-yellow-200">
              Please sign in with your Nostr account first to use Spark wallet
            </p>
          </div>
        )}

        {pubkey && hasSavedWallet && !connected && connecting && (
          <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-400 rounded-lg space-y-2">
            <p className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Loader2 className="animate-spin size-4" />
              Restoring wallet...
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Loading encrypted mnemonic from secure storage
            </p>
          </div>
        )}

        {!connected && pubkey && !hasSavedWallet ? (
          <>
            <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-400 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                💡 Your mnemonic will be encrypted and saved to this device, tied to your Nostr account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Breez API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {import.meta.env.VITE_BREEZ_SPARK_API_KEY && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ API key loaded from .env.local
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="mnemonic">Mnemonic (Required)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="h-auto p-1"
                >
                  {showMnemonic ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <textarea
                id="mnemonic"
                placeholder="Enter your 12 or 24 word BIP39 seed phrase"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                style={{ WebkitTextSecurity: showMnemonic ? 'none' : 'disc' }}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Enter your existing wallet's 12 or 24 word mnemonic</p>
                <p>• Or generate a new one at: <a href="https://iancoleman.io/bip39/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">iancoleman.io/bip39</a></p>
                <p>• Words should be separated by spaces</p>
                <p className="text-yellow-600 dark:text-yellow-500">⚠️ Will be encrypted with your Nostr key and saved locally</p>
              </div>
            </div>

            <Button onClick={handleConnect} disabled={connecting || !apiKey || !mnemonic.trim()} className="w-full">
              {connecting && <Loader2 className="animate-spin" />}
              Connect & Save Wallet
            </Button>
            {(!apiKey || !mnemonic.trim()) && (
              <p className="text-xs text-red-500 text-center">
                Both API key and mnemonic are required
              </p>
            )}
          </>
        ) : connected ? (
          <>
            {generatedMnemonic && (
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg space-y-2">
                <p className="font-semibold text-yellow-900 dark:text-yellow-200">
                  ⚠️ Save Your Mnemonic!
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 font-mono break-all">
                  {generatedMnemonic}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Write this down securely. You'll need it to recover your wallet.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label>Balance</Label>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {balance !== null ? `${balance.toLocaleString()} sats` : 'Loading...'}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRefreshBalance} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin size-4" /> : 'Sync & Refresh'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Balance auto-updates when payments are received
                </p>
              </div>

              {lightningAddress && (
                <div>
                  <Label>Lightning Address</Label>
                  <p className="text-sm font-mono text-muted-foreground">{lightningAddress}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleGenerateInvoice}
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                {loading && <Loader2 className="animate-spin" />}
                Generate Test Invoice (1000 sats)
              </Button>
              {invoice && (
                <div className="p-2 bg-muted rounded text-xs font-mono break-all">{invoice}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentRequest">Send Payment</Label>
              <Input
                id="paymentRequest"
                placeholder="Paste invoice or Lightning address"
                value={paymentRequest}
                onChange={(e) => setPaymentRequest(e.target.value)}
              />
              <Button onClick={handleSendPayment} disabled={loading || !paymentRequest} className="w-full">
                {loading && <Loader2 className="animate-spin" />}
                Send Payment
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDisconnect} variant="outline" className="flex-1">
                Disconnect
              </Button>
              <Button onClick={handleDeleteWallet} variant="destructive" className="flex-1">
                Delete Wallet
              </Button>
            </div>
          </>
        ) : null}

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p>🧪 This is a POC test page for Spark SDK integration</p>
          <p>🔐 Mnemonic encrypted with XChaCha20-Poly1305 using your Nostr pubkey</p>
          <p>💾 Saved locally on this device</p>
          <p>⚠️ Do not use with large amounts - testing only!</p>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
SparkTestPage.displayName = 'SparkTestPage'
export default SparkTestPage
