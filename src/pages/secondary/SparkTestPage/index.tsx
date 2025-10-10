import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import sparkService from '@/services/spark.service'
import sparkStorage from '@/services/spark-storage.service'
import sparkProfileSync from '@/services/spark-profile-sync.service'
import CodepenLightning from '@/components/animations/CodepenLightning'
import SparkPaymentsList from '@/components/SparkPaymentsList'
import { Eye, EyeOff, Loader2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import QRCodeStyling from 'qr-code-styling'

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
  const { pubkey, profileEvent, publish, updateProfileEvent } = useNostr()
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_BREEZ_SPARK_API_KEY || '')
  const [mnemonic, setMnemonic] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [showGeneratedMnemonic, setShowGeneratedMnemonic] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [lightningAddress, setLightningAddress] = useState('')
  const [invoice, setInvoice] = useState('')
  const [paymentRequest, setPaymentRequest] = useState('')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [hasSavedWallet, setHasSavedWallet] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<number>(1000)
  const [showTopUpDialog, setShowTopUpDialog] = useState(false)
  const [showLightning, setShowLightning] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'payments' | 'topup'>('payments')
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [hasMorePayments, setHasMorePayments] = useState(true)
  const [paymentsOffset, setPaymentsOffset] = useState(0)
  const [editingLightningAddress, setEditingLightningAddress] = useState(false)
  const [newLightningUsername, setNewLightningUsername] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const qrCodeRef = useRef<HTMLDivElement>(null)

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

  // Load payment history
  const loadPayments = async (reset = false) => {
    if (!connected) return

    setLoadingPayments(true)
    try {
      const offset = reset ? 0 : paymentsOffset
      const limit = 20 // Load 20 at a time
      const paymentList = await sparkService.listPayments(offset, limit)

      if (reset) {
        setPayments(paymentList)
        setPaymentsOffset(paymentList.length)
      } else {
        setPayments(prev => [...prev, ...paymentList])
        setPaymentsOffset(prev => prev + paymentList.length)
      }

      // If we got fewer payments than requested, there are no more
      setHasMorePayments(paymentList.length >= limit)

      console.log('[SparkTestPage] Loaded payments:', paymentList.length, 'Total:', reset ? paymentList.length : payments.length + paymentList.length)
    } catch (error) {
      console.error('[SparkTestPage] Failed to load payments:', error)
    } finally {
      setLoadingPayments(false)
    }
  }

  // Load more payments
  const loadMorePayments = () => {
    if (!loadingPayments && hasMorePayments) {
      loadPayments(false)
    }
  }

  // Load payments when connected or tab changes
  useEffect(() => {
    if (connected && activeTab === 'payments') {
      loadPayments(true) // Reset to first page
    }
  }, [connected, activeTab])

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
            // Reload payments to show new transaction
            loadPayments(true)

            // Show lightning animation
            setShowLightning(true)

            // Show success checkmark after lightning starts
            setTimeout(() => {
              setShowSuccess(true)
              toast.success('Payment received! Balance updated')
            }, 300)

            // Hide animations and close dialog after they complete
            setTimeout(() => {
              setShowLightning(false)
              setShowSuccess(false)
              setShowTopUpDialog(false)
              setInvoice('')
            }, 2500)
          }
        } catch (error) {
          console.error('Failed to update balance:', error)
        }
      }
    })

    return unsubscribe
  }, [connected])

  // Generate QR code when invoice changes
  useEffect(() => {
    if (!invoice || !qrCodeRef.current || !showTopUpDialog) return

    // Clear QR code if showing success animation
    if (showSuccess) {
      qrCodeRef.current.innerHTML = ''
      return
    }

    // Clear previous QR code
    qrCodeRef.current.innerHTML = ''

    // Calculate responsive QR code size
    const containerWidth = qrCodeRef.current.parentElement?.clientWidth || 300
    const qrSize = Math.min(containerWidth - 32, 400) // Max 400px, with padding

    const qrCode = new QRCodeStyling({
      width: qrSize,
      height: qrSize,
      data: invoice.toUpperCase(),
      margin: 10,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: 'M'
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 5
      },
      dotsOptions: {
        color: '#000000',
        type: 'rounded'
      },
      backgroundOptions: {
        color: '#ffffff'
      },
      cornersSquareOptions: {
        color: '#000000',
        type: 'extra-rounded'
      },
      cornersDotOptions: {
        color: '#000000',
        type: 'dot'
      }
    })

    qrCode.append(qrCodeRef.current)
  }, [invoice, showTopUpDialog, showSuccess])

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

        // Sync Lightning address to Nostr profile
        await sparkProfileSync.syncLightningAddressToProfile(
          addr.lightningAddress,
          profileEvent,
          publish,
          updateProfileEvent
        )
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

        // Sync Lightning address to Nostr profile
        await sparkProfileSync.syncLightningAddressToProfile(
          addr.lightningAddress,
          profileEvent,
          publish,
          updateProfileEvent
        )
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

  const handleGenerateInvoice = async (amount: number) => {
    setLoading(true)
    try {
      const response = await sparkService.receivePayment(amount, `Top up Spark wallet: ${amount} sats`)
      setInvoice(response.paymentRequest)
      setShowTopUpDialog(true)
      toast.success('Invoice generated - scan to top up')
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

    // Check if amount is needed (for Lightning addresses or zero-amount invoices)
    const isLightningAddress = paymentRequest.includes('@')
    if (isLightningAddress && paymentAmount === 0) {
      toast.error('Amount is required for Lightning addresses')
      return
    }

    setLoading(true)
    try {
      // Pass amount if it's set, otherwise undefined
      const amountToSend = paymentAmount > 0 ? paymentAmount : undefined
      await sparkService.sendPayment(paymentRequest, amountToSend)
      toast.success('Payment sent successfully')

      // Refresh balance
      const info = await sparkService.getInfo()
      setBalance(info.balanceSats)
      setPaymentRequest('')
      setPaymentAmount(0)
    } catch (error) {
      toast.error(`Payment failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  // Check username availability with debounce
  useEffect(() => {
    if (!newLightningUsername || newLightningUsername.length < 3) {
      setUsernameAvailable(null)
      return
    }

    const timeoutId = setTimeout(async () => {
      setCheckingUsername(true)
      try {
        const available = await sparkService.checkLightningAddressAvailable(newLightningUsername)
        setUsernameAvailable(available)
      } catch (error) {
        console.error('[SparkTestPage] Error checking username:', error)
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [newLightningUsername])

  const handleChangeLightningAddress = async () => {
    if (!newLightningUsername || !usernameAvailable) return

    setLoading(true)
    try {
      const result = await sparkService.setLightningAddress(newLightningUsername)
      setLightningAddress(result.lightningAddress)
      setEditingLightningAddress(false)
      setNewLightningUsername('')
      toast.success(`Lightning address updated to ${result.lightningAddress}`)

      // Sync to Nostr profile with confirmation
      if (publish && currentProfileEvent && window.confirm(`Update your Nostr profile with Lightning address ${result.lightningAddress}?`)) {
        await sparkProfileSyncService.syncLightningAddressToProfile(
          result.lightningAddress,
          currentProfileEvent,
          publish,
          updateProfileEvent
        )
      }
    } catch (error) {
      console.error('[SparkTestPage] Failed to change Lightning address:', error)
      toast.error('Failed to change Lightning address')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLightningAddress = async () => {
    if (!window.confirm('Are you sure you want to delete your Lightning address?')) return

    setLoading(true)
    try {
      await sparkService.deleteLightningAddress()
      setLightningAddress('')
      toast.success('Lightning address deleted')
    } catch (error) {
      console.error('[SparkTestPage] Failed to delete Lightning address:', error)
      toast.error('Failed to delete Lightning address')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title="Spark SDK Test (POC)">
      {/* Lightning animation overlay */}
      {showLightning && <CodepenLightning duration={1000} active={showLightning} />}

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
              <div className="flex items-center justify-between">
                <Label htmlFor="mnemonic">Recovery Phrase (Required)</Label>
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
                placeholder="Enter your 12 or 24 word recovery phrase"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                style={{ WebkitTextSecurity: showMnemonic ? 'none' : 'disc' }}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Enter your existing wallet's 12 or 24 word recovery phrase</p>
                <p>• Or generate a new one at: <a href="https://iancoleman.io/bip39/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">iancoleman.io/bip39</a></p>
                <p>• Words should be separated by spaces</p>
                <p className="text-yellow-600 dark:text-yellow-500">⚠️ Will be encrypted with your Nostr key and saved locally</p>
              </div>
            </div>

            <Button onClick={handleConnect} disabled={connecting || !mnemonic.trim()} className="w-full">
              {connecting && <Loader2 className="animate-spin" />}
              Connect & Save Wallet
            </Button>
            {!mnemonic.trim() && (
              <p className="text-xs text-red-500 text-center">
                Mnemonic is required
              </p>
            )}
          </>
        ) : connected ? (
          <>
            {generatedMnemonic && (
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200">
                    ⚠️ Save Your Recovery Phrase!
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGeneratedMnemonic(!showGeneratedMnemonic)}
                      className="h-auto p-1"
                    >
                      {showGeneratedMnemonic ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGeneratedMnemonic('')}
                      className="h-auto p-1"
                      title="Dismiss"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
                {showGeneratedMnemonic ? (
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-mono break-all">
                    {generatedMnemonic}
                  </p>
                ) : (
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Click the eye icon to reveal your recovery phrase
                  </p>
                )}
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Write this down securely. You'll need it to recover your wallet.
                </p>
              </div>
            )}

            {/* Balance Display - Always visible at top */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Balance</Label>
                <Button variant="ghost" size="sm" onClick={handleRefreshBalance} disabled={loading} className="h-auto py-1 px-2 text-xs">
                  {loading ? <Loader2 className="animate-spin size-3" /> : 'Sync'}
                </Button>
              </div>
              <p className="text-3xl font-bold">
                {balance !== null ? `${balance.toLocaleString()} sats` : 'Loading...'}
              </p>
              {lightningAddress && (
                <div className="text-xs text-muted-foreground font-mono break-all">
                  {lightningAddress}
                </div>
              )}
            </div>

            {/* Tabbed Interface */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'payments' | 'topup')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="topup">Top Up</TabsTrigger>
              </TabsList>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-4 mt-4">
                {/* Send Payment */}
                <div className="space-y-2">
                  <Label htmlFor="paymentRequest" className="text-sm">Send Payment</Label>
                  <Input
                    id="paymentRequest"
                    placeholder="Paste invoice or Lightning address"
                    value={paymentRequest}
                    onChange={(e) => setPaymentRequest(e.target.value)}
                  />

                  {/* Amount field - shown for Lightning addresses */}
                  {paymentRequest.includes('@') && (
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount" className="text-xs">
                        Amount (sats) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="paymentAmount"
                        type="number"
                        placeholder="Enter amount in sats"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        min="1"
                      />
                    </div>
                  )}

                  <Button onClick={handleSendPayment} disabled={loading || !paymentRequest} className="w-full">
                    {loading && <Loader2 className="animate-spin" />}
                    Send Payment
                  </Button>
                </div>

                {/* Payment History */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Recent Payments</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadPayments(true)}
                      disabled={loadingPayments}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      {loadingPayments ? <Loader2 className="animate-spin size-3" /> : 'Refresh'}
                    </Button>
                  </div>
                  <SparkPaymentsList payments={payments} loading={loadingPayments} />

                  {/* Load More Button */}
                  {hasMorePayments && payments.length > 0 && !loadingPayments && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMorePayments}
                      className="w-full"
                    >
                      Load More
                    </Button>
                  )}

                  {/* Loading indicator for load more */}
                  {loadingPayments && payments.length > 0 && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="animate-spin size-4 text-muted-foreground" />
                    </div>
                  )}

                  {/* End of list indicator */}
                  {!hasMorePayments && payments.length > 0 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      No more payments
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Top-Up Tab */}
              <TabsContent value="topup" className="space-y-4 mt-4">
                {/* Wallet Top-Up Section */}
                <div className="space-y-4">
                  {!showTopUpDialog && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold">Choose an amount to deposit</Label>
                        {(balance || 0) + topUpAmount > 100000 && (
                          <span className="text-xs text-amber-600 dark:text-amber-500">
                            ⚠️ Hot wallet
                          </span>
                        )}
                      </div>

                      {/* Preset Amounts - 2 column grid like Fountain */}
                      <div className="grid grid-cols-2 gap-3">
                        {[1000, 5000, 10000, 20000, 50000, 100000].map((amount) => {
                          const currentBalance = balance || 0
                          const maxAllowed = 500000
                          const remainingCapacity = maxAllowed - currentBalance
                          const wouldExceedLimit = amount > remainingCapacity
                          const newBalance = currentBalance + amount

                          return (
                            <Button
                              key={amount}
                              variant={topUpAmount === amount ? 'default' : 'outline'}
                              size="lg"
                              onClick={() => setTopUpAmount(amount)}
                              disabled={wouldExceedLimit}
                              className="h-auto py-4 flex flex-col items-start gap-1"
                              title={wouldExceedLimit ? `Would exceed 500k limit (current: ${currentBalance.toLocaleString()})` : undefined}
                            >
                              <span className={`text-lg font-bold ${wouldExceedLimit ? 'text-muted-foreground' : ''}`}>
                                {amount.toLocaleString()} sats
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ≈${(amount * 0.001217).toFixed(2)}
                              </span>
                              {wouldExceedLimit && (
                                <span className="text-xs text-red-500">Over limit</span>
                              )}
                            </Button>
                          )
                        })}
                      </div>

                      {/* Custom Amount Button */}
                      <Button
                        variant={topUpAmount > 100000 && topUpAmount !== 100000 ? 'default' : 'outline'}
                        size="lg"
                        onClick={() => {
                          const currentBalance = balance || 0
                          const maxAllowed = 500000
                          const remainingCapacity = maxAllowed - currentBalance
                          const customAmount = prompt(
                            `Enter custom amount in sats (max ${remainingCapacity.toLocaleString()} remaining):`,
                            Math.min(topUpAmount, remainingCapacity).toString()
                          )
                          if (customAmount) {
                            const val = parseInt(customAmount) || 0
                            setTopUpAmount(Math.min(Math.max(val, 0), remainingCapacity))
                          }
                        }}
                        className="w-full h-auto py-4 flex items-center justify-between"
                      >
                        <span className="text-lg">Custom</span>
                        <span className="text-muted-foreground">⚙️</span>
                      </Button>

                      {/* Safety Warning */}
                      {(balance || 0) + topUpAmount > 100000 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded text-xs">
                          <p className="font-semibold text-amber-900 dark:text-amber-200">
                            ⚠️ Hot Wallet Warning
                          </p>
                          <p className="text-amber-800 dark:text-amber-300 mt-1">
                            Hot wallets should not contain large balances. Consider keeping less than 100k sats for daily use.
                          </p>
                        </div>
                      )}

                      {/* Balance Limit Warning */}
                      {(balance || 0) + topUpAmount > 500000 && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 rounded text-xs">
                          <p className="font-semibold text-red-900 dark:text-red-200">
                            Maximum Balance Exceeded
                          </p>
                          <p className="text-red-800 dark:text-red-300 mt-1">
                            Total balance would be {((balance || 0) + topUpAmount).toLocaleString()} sats.
                            Maximum allowed is 500,000 sats.
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={() => handleGenerateInvoice(topUpAmount)}
                        disabled={loading || topUpAmount === 0 || (balance || 0) + topUpAmount > 500000}
                        className="w-full h-12 text-base"
                        size="lg"
                      >
                        {loading && <Loader2 className="animate-spin" />}
                        Generate invoice
                      </Button>
                    </>
                  )}

                  {/* Invoice Display Dialog */}
                  {showTopUpDialog && invoice && (
                    <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-700 rounded">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-blue-900 dark:text-blue-200">
                          Invoice Generated
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowTopUpDialog(false)
                            setInvoice('')
                          }}
                          className="h-auto p-1"
                        >
                          ✕
                        </Button>
                      </div>
                      {!showSuccess && (
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          Scan QR code or copy invoice to top up your wallet
                        </p>
                      )}

                      {/* QR Code or Success Animation */}
                      <div className={`flex justify-center p-4 rounded-lg overflow-hidden min-h-[280px] relative ${showSuccess ? 'bg-transparent' : 'bg-white'}`}>
                        {/* QR Code Container - hidden when success is showing */}
                        <div
                          ref={qrCodeRef}
                          className={`flex items-center justify-center max-w-full ${showSuccess ? 'hidden' : ''}`}
                        />

                        {/* Success Animation - shown when payment succeeds */}
                        {showSuccess && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-green-500 rounded-full p-8 animate-in fade-in zoom-in duration-300">
                              <CheckCircle className="w-32 h-32 text-white" strokeWidth={2} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Invoice String - hidden when success is showing */}
                      {!showSuccess && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs text-blue-900 dark:text-blue-200">Lightning Invoice</Label>
                            <div className="p-2 bg-white dark:bg-gray-900 rounded text-xs font-mono break-all border max-h-24 overflow-y-auto">
                              {invoice}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(invoice)
                              toast.success('Invoice copied to clipboard')
                            }}
                            className="w-full"
                          >
                            Copy Invoice
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Collapsible Settings Section */}
            <div className="border-t pt-4 space-y-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="text-sm">Wallet Settings</span>
                {showSettings ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>

              {showSettings && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  {/* Lightning Address Management */}
                  <div className="space-y-2">
                    <Label className="text-sm">Lightning Address</Label>
                    {!editingLightningAddress ? (
                      <div className="flex items-center gap-2">
                        {lightningAddress ? (
                          <>
                            <div className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                              {lightningAddress}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingLightningAddress(true)
                                setNewLightningUsername(lightningAddress.split('@')[0])
                              }}
                            >
                              Change
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleDeleteLightningAddress}
                              disabled={loading}
                            >
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingLightningAddress(true)}
                            className="w-full"
                          >
                            Register Lightning Address
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="username"
                            value={newLightningUsername}
                            onChange={(e) => setNewLightningUsername(e.target.value.toLowerCase())}
                            className="flex-1"
                          />
                          <span className="text-sm text-muted-foreground">@breez.tips</span>
                        </div>
                        {checkingUsername && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="size-3 animate-spin" />
                            Checking availability...
                          </p>
                        )}
                        {!checkingUsername && usernameAvailable === true && (
                          <p className="text-xs text-green-600">✓ Available</p>
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <p className="text-xs text-red-600">✗ Already taken</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleChangeLightningAddress}
                            disabled={!usernameAvailable || loading}
                            className="flex-1"
                          >
                            {loading ? <Loader2 className="animate-spin size-4" /> : 'Save'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingLightningAddress(false)
                              setNewLightningUsername('')
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disconnect and Delete */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">Wallet Management</Label>
                    <div className="flex gap-2">
                      <Button onClick={handleDisconnect} variant="outline" className="flex-1" size="sm">
                        Disconnect
                      </Button>
                      <Button onClick={handleDeleteWallet} variant="destructive" className="flex-1" size="sm">
                        Delete Wallet
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p>🧪 This is a POC test page for Spark SDK integration</p>
          <p>🔐 Recovery phrase encrypted with XChaCha20-Poly1305 using your Nostr pubkey</p>
          <p>💾 Saved locally on this device</p>
          <p>⚠️ Do not use with large amounts - testing only!</p>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
SparkTestPage.displayName = 'SparkTestPage'
export default SparkTestPage
