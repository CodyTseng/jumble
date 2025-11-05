import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { useSparkWallet } from '@/providers/SparkWalletProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import sparkService from '@/services/spark.service'
import sparkStorage from '@/services/spark-storage.service'
import sparkProfileSync from '@/services/spark-profile-sync.service'
import sparkBackup from '@/services/spark-backup.service'
import CodepenLightning from '@/components/animations/CodepenLightning'
import SparkPaymentsList from '@/components/SparkPaymentsList'
import DefaultZapAmountInput from '@/pages/secondary/WalletPage/DefaultZapAmountInput'
import DefaultZapCommentInput from '@/pages/secondary/WalletPage/DefaultZapCommentInput'
import QuickZapSwitch from '@/pages/secondary/WalletPage/QuickZapSwitch'
import { Eye, EyeOff, Loader2, CheckCircle, ChevronDown, ChevronUp, PlusCircle, Cloud, FolderOpen, AlertTriangle, Zap, Settings, XCircle, Key, HardDrive, Download, Pencil } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import QRCodeStyling from 'qr-code-styling'
import { toWallet } from '@/lib/link'

/**
 * Spark Wallet - Lightning wallet powered by Breez Spark SDK
 *
 * Core functionality:
 * - Wallet management and connection
 * - Balance display and monitoring
 * - Send and receive Lightning payments
 * - Lightning address registration
 * - Invoice generation
 * - Encrypted backup and recovery
 * - Nostr relay sync
 */
const SparkWalletPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { pubkey, profileEvent, publish, updateProfileEvent, nip44Encrypt, nip44Decrypt, nip04Decrypt } = useNostr()
  const { showWalletInSidebar, updateShowWalletInSidebar } = useUserPreferences()
  const {
    connected,
    balance: providerBalance,
    lightningAddress: providerLightningAddress,
    refreshWalletState
  } = useSparkWallet()

  const [apiKey] = useState(import.meta.env.VITE_BREEZ_SPARK_API_KEY || '')
  const [mnemonic, setMnemonic] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [showGeneratedMnemonic, setShowGeneratedMnemonic] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [invoice, setInvoice] = useState('')
  const [paymentRequest, setPaymentRequest] = useState('')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [hasSavedWallet, setHasSavedWallet] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<number>(1000)
  const [showTopUpDialog, setShowTopUpDialog] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
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
  const [showLightningAddressQR, setShowLightningAddressQR] = useState(false)
  const [setupMode, setSetupMode] = useState<'choose' | 'create' | 'restore-file' | 'restore-relays' | 'manual'>('choose')
  const [backingUp, setBackingUp] = useState(false)
  const [revealedMnemonic, setRevealedMnemonic] = useState('')
  const [showRevealedMnemonic, setShowRevealedMnemonic] = useState(false)
  const [waitingForFileSelection, setWaitingForFileSelection] = useState(false)
  const [hasRelayBackup, setHasRelayBackup] = useState(false)
  const [checkingRelayBackup, setCheckingRelayBackup] = useState(false)
  const [resyncingBackup, setResyncingBackup] = useState(false)
  const [checkingBackupLocations, setCheckingBackupLocations] = useState(false)
  const [backupLocations, setBackupLocations] = useState<Record<string, boolean>>({})
  const [showBackupLocations, setShowBackupLocations] = useState(false)
  const [backupEncryptionVersion, setBackupEncryptionVersion] = useState<'nip44' | 'nip04' | null>(null)
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const lightningAddressQRRef = useRef<HTMLDivElement>(null)
  const lightningAddressSectionRef = useRef<HTMLDivElement>(null)
  const fileSelectionAbortRef = useRef<(() => void) | null>(null)
  const lastPaymentEventRef = useRef<string | null>(null)

  // Check for saved wallet on mount
  useEffect(() => {
    if (!pubkey) return

    const hasSaved = sparkStorage.hasMnemonic(pubkey)
    setHasSavedWallet(hasSaved)

    if (!hasSaved) {
      console.log('[SparkWallet] No saved wallet found locally')
      // Check if there's a relay backup available
      checkForRelayBackup()
    } else {
      console.log('[SparkWallet] Found saved wallet, provider will auto-connect')
    }
  }, [pubkey])

  // Check encryption version when settings are opened
  useEffect(() => {
    if (showSettings && connected && pubkey) {
      handleCheckEncryptionVersion()
    }
  }, [showSettings, connected, pubkey])

  // Check if user has a wallet backup on Nostr relays
  const checkForRelayBackup = async () => {
    if (!pubkey) return

    setCheckingRelayBackup(true)
    try {
      const hasBackup = await sparkBackup.hasBackupOnNostr()
      setHasRelayBackup(hasBackup)
      if (hasBackup) {
        console.log('[SparkWallet] Found wallet backup on Nostr relays')
      } else {
        console.log('[SparkWallet] No wallet backup found on relays')
      }
    } catch (error) {
      console.error('[SparkWallet] Failed to check for relay backup:', error)
      setHasRelayBackup(false)
    } finally {
      setCheckingRelayBackup(false)
    }
  }

  // Load payment history
  const loadPayments = async (reset = false, silent = false) => {
    if (!connected) return

    if (!silent) {
      setLoadingPayments(true)
    }
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

      console.log('[SparkWallet] Loaded payments:', paymentList.length, 'Total:', reset ? paymentList.length : payments.length + paymentList.length)
    } catch (error) {
      console.error('[SparkWallet] Failed to load payments:', error)
    } finally {
      if (!silent) {
        setLoadingPayments(false)
      }
    }
  }

  // Refresh a specific payment
  const refreshPayment = async (paymentId: string) => {
    if (!connected) return

    try {
      // Reload the payment list to get updated status
      const paymentList = await sparkService.listPayments(0, payments.length || 20)

      // Update the payments list while preserving pagination
      setPayments(paymentList)

      // Find the updated payment to check if status changed
      const updatedPayment = paymentList.find(p => p.id === paymentId)
      if (updatedPayment) {
        console.log('[SparkWallet] Payment refreshed:', paymentId, 'Status:', updatedPayment.status)
      }
    } catch (error) {
      console.error('[SparkWallet] Failed to refresh payment:', error)
      throw error
    }
  }

  // Load more payments
  const loadMorePayments = () => {
    if (!loadingPayments && hasMorePayments) {
      loadPayments(false)
    }
  }

  // Refresh wallet state when connected
  useEffect(() => {
    if (connected) {
      console.log('[SparkWallet] Wallet connected, refreshing state...')
      refreshWalletState()
    }
  }, [connected])

  // Load payments when connected or tab changes
  useEffect(() => {
    if (connected && activeTab === 'payments') {
      loadPayments(true) // Reset to first page
    }
  }, [connected, activeTab])

  // Poll for pending payment status updates
  useEffect(() => {
    if (!connected || activeTab !== 'payments') return

    // Check for pending payments and poll for updates
    const checkPendingPayments = () => {
      const hasPending = payments.some(p => p.status === 'pending')
      if (hasPending) {
        console.log('[SparkWallet] Pending payments detected, refreshing silently...')
        loadPayments(true, true) // Silent refresh - no loading indicator
      }
    }

    // Poll every 3 seconds when there are pending payments
    const intervalId = setInterval(checkPendingPayments, 3000)

    return () => clearInterval(intervalId)
  }, [connected, activeTab, payments])

  // Auto-refresh balance when payment events occur
  useEffect(() => {
    if (!connected) return

    const unsubscribe = sparkService.onEvent(async (event) => {
      console.log('[SparkWallet] Received event:', event.type)

      if (event.type === 'paymentSucceeded' || event.type === 'paymentFailed' || event.type === 'synced') {
        // Refresh balance from provider
        try {
          await refreshWalletState()

          if (event.type === 'paymentSucceeded') {
            // Only show notification for received payments, not sent payments
            const payment = event.payment
            const isReceived = payment?.paymentType === 'receive'

            console.log('[SparkWallet] Payment succeeded, type:', payment?.paymentType)

            // Create a unique event ID using timestamp + amount + type
            const eventId = `${payment?.paymentType}_${payment?.timestamp || Date.now()}_${payment?.amount || 0}`

            // Check if we already processed this payment event
            if (lastPaymentEventRef.current === eventId) {
              console.log('[SparkWallet] Duplicate payment event detected, skipping notification')
              return
            }

            // Store this event ID to prevent duplicates
            lastPaymentEventRef.current = eventId

            // Reload payments to show new transaction (both sent and received)
            loadPayments(true)

            // Only show animation and notification for received payments
            if (isReceived) {
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
          } else if (event.type === 'paymentFailed') {
            console.log('[SparkWallet] Payment failed:', event.payment)
            // Reload payments to update status
            loadPayments(true)
          }
        } catch (error) {
          console.error('[SparkWallet] Failed to update balance:', error)
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

  // Generate QR code for Lightning address
  useEffect(() => {
    if (!showLightningAddressQR || !providerLightningAddress || !lightningAddressQRRef.current) return

    lightningAddressQRRef.current.innerHTML = ''

    const containerWidth = lightningAddressQRRef.current.parentElement?.clientWidth || 300
    const qrSize = Math.min(containerWidth - 32, 300)

    const qrCode = new QRCodeStyling({
      width: qrSize,
      height: qrSize,
      data: providerLightningAddress,
      margin: 10,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: 'M'
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

    qrCode.append(lightningAddressQRRef.current)
  }, [providerLightningAddress, showLightningAddressQR])

  const handleConnect = async (providedMnemonic?: string) => {
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
      const mnemonicToUse = providedMnemonic || mnemonic || undefined
      const result = await sparkService.connect(apiKey, mnemonicToUse, 'mainnet')

      if (result.mnemonic) {
        setGeneratedMnemonic(result.mnemonic)
      }

      // Save encrypted mnemonic
      await sparkStorage.saveMnemonic(pubkey, result.mnemonic)
      setHasSavedWallet(true)
      toast.success('Wallet connected & encrypted mnemonic saved!')

      // Refresh wallet state from provider
      console.log('[SparkWallet] Refreshing wallet state from provider...')
      await refreshWalletState()
      console.log('[SparkWallet] Wallet state refreshed')

      // Try to get Lightning address and ask if user wants to sync to profile
      console.log('[SparkWallet] Fetching Lightning address...')
      const addr = await sparkService.getLightningAddress()
      console.log('[SparkWallet] Lightning address result:', addr)
      if (addr) {
        // Ask user if they want to update their Nostr profile with this Lightning address
        if (publish && profileEvent && window.confirm(`Update your Nostr profile with Lightning address ${addr.lightningAddress}?`)) {
          console.log('[SparkWallet] User confirmed - syncing Lightning address to Nostr profile...')
          try {
            await sparkProfileSync.syncLightningAddressToProfile(
              addr.lightningAddress,
              profileEvent,
              publish,
              updateProfileEvent
            )
            console.log('[SparkWallet] Lightning address synced to profile')
            toast.success(`Lightning address ${addr.lightningAddress} added to your Nostr profile`)
          } catch (syncError) {
            console.error('[SparkWallet] Failed to sync to Nostr profile:', syncError)
            const errorMessage = syncError instanceof Error ? syncError.message : String(syncError)
            console.error('[SparkWallet] Sync error details:', errorMessage)
            toast.warning(`Lightning address is active, but couldn't update your Nostr profile: ${errorMessage}. You can manually sync it in Settings.`)
          }
        } else {
          console.log('[SparkWallet] User declined to sync Lightning address to profile')
          toast.info(`Lightning address ${addr.lightningAddress} is active. You can sync it to your profile later in Settings.`)
        }
      } else {
        console.log('[SparkWallet] No Lightning address found for this wallet')
        // If this was a manual connection (not from create/restore handlers), show helpful message
        if (!providedMnemonic) {
          toast.info('Tip: Register a Lightning address in Settings to receive payments easily')
        }
      }

      // Hide mnemonic input after successful connection
      setShowMnemonic(false)
      setMnemonic('')

      // Switch to wallet view after successful setup
      setSetupMode('choose')
    } catch (error) {
      console.error('Connection error:', error)
      toast.error(`Connection failed: ${(error as Error).message}`)
    } finally {
      setConnecting(false)
    }
  }

  const handleRevealRecoveryPhrase = async () => {
    if (!pubkey) {
      toast.error('No wallet connected')
      return
    }

    if (!confirm('⚠️ Warning: Your recovery phrase gives full access to your wallet!\n\nOnly reveal this in a secure, private location.\n\nAnyone with these 12 words can access your funds.\n\nDo you want to continue?')) {
      return
    }

    setLoading(true)
    try {
      // Load the current mnemonic from storage
      const currentMnemonic = await sparkStorage.loadMnemonic(pubkey)
      if (!currentMnemonic) {
        toast.error('No wallet found')
        return
      }

      // Set it in the settings section state
      setRevealedMnemonic(currentMnemonic)
      setShowRevealedMnemonic(true)
      toast.success('Recovery phrase revealed below. Write it down securely!')
    } catch (error) {
      console.error('[SparkWallet] Failed to reveal recovery phrase:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to reveal recovery phrase: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBackup = async () => {
    if (!pubkey || !nip44Encrypt) {
      toast.error('Unable to create backup - missing encryption')
      return
    }

    setLoading(true)
    try {
      // Load the current mnemonic from storage
      const currentMnemonic = await sparkStorage.loadMnemonic(pubkey)
      if (!currentMnemonic) {
        toast.error('No wallet found to backup')
        return
      }

      // Download encrypted backup file (using NIP-44)
      await sparkBackup.downloadBackupFile(currentMnemonic, pubkey, nip44Encrypt)
      toast.success('Backup file downloaded!')
    } catch (error) {
      console.error('[SparkWallet] Failed to download backup:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to download backup: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  // Remove wallet from device but keep relay backup for future restoration
  const handleRemoveWalletKeepBackup = async () => {
    if (!pubkey) return

    const confirmed = confirm(
      '♻️ Remove wallet from device (keep relay backup)\n\n' +
      '✅ Your wallet backup will remain on your Nostr relays\n' +
      '✅ You can restore it later from relays\n' +
      '✅ Your Lightning address and funds remain safe\n' +
      '✅ No data will be permanently deleted\n\n' +
      '⚠️ Make sure you can still access your Nostr profile to restore later!\n\n' +
      'Click OK to remove wallet from this device only.\n' +
      'Click Cancel to go back safely.'
    )

    if (!confirmed) {
      return
    }

    try {
      await sparkService.disconnect()
      await sparkStorage.deleteMnemonic(pubkey, false) // Keep relay backup

      // Clear all local state
      setGeneratedMnemonic('')
      setRevealedMnemonic('')
      setHasSavedWallet(false)
      setPayments([])
      setInvoice('')
      setPaymentRequest('')

      toast.success('Wallet removed from device. Relay backup preserved for future restoration.')

      // Navigate back to wallet selection page
      setTimeout(() => {
        window.location.href = toWallet()
      }, 500)
    } catch (error) {
      console.error('[SparkWallet] Failed to remove wallet:', error)
      toast.error(`Failed to remove wallet: ${(error as Error).message}`)
    }
  }

  // Remove wallet from device AND delete relay backup (complete removal)
  const handleRemoveWalletDeleteBackup = async () => {
    if (!pubkey) return

    const confirmed = confirm(
      '⚠️ PERMANENTLY REMOVE WALLET\n\n' +
      '🚨 This will:\n' +
      '❌ Remove the wallet from this device\n' +
      '❌ DELETE the backup from your Nostr relays\n' +
      '❌ Make restoration impossible without a backup file or recovery phrase\n\n' +
      '✅ Your Lightning address will still work\n' +
      '✅ Your funds remain safe in your Spark wallet\n\n' +
      '⚠️ ONLY DO THIS IF:\n' +
      '• You have downloaded your backup file, OR\n' +
      '• You have written down your 12-word recovery phrase, OR\n' +
      '• You are intentionally removing this wallet completely\n\n' +
      'Click OK to permanently remove wallet and delete relay backup.\n' +
      'Click Cancel to go back safely.'
    )

    if (!confirmed) {
      return
    }

    // Second confirmation for safety
    const doubleCheck = confirm(
      '⚠️ FINAL CONFIRMATION\n\n' +
      'Are you absolutely sure?\n\n' +
      'This will DELETE the relay backup and you will NOT be able to restore from relays.\n\n' +
      'Have you saved your backup file or recovery phrase?\n\n' +
      'Click OK to proceed with permanent removal.\n' +
      'Click Cancel to go back safely.'
    )

    if (!doubleCheck) {
      return
    }

    try {
      await sparkService.disconnect()
      await sparkStorage.deleteMnemonic(pubkey, true) // Delete relay backup

      // Clear all local state
      setGeneratedMnemonic('')
      setRevealedMnemonic('')
      setHasSavedWallet(false)
      setPayments([])
      setInvoice('')
      setPaymentRequest('')

      toast.success('Wallet removed from device and relay backup deleted.')

      // Navigate back to wallet selection page
      setTimeout(() => {
        window.location.href = toWallet()
      }, 500)
    } catch (error) {
      console.error('[SparkWallet] Failed to remove wallet:', error)
      toast.error(`Failed to remove wallet: ${(error as Error).message}`)
    }
  }

  const handleRefreshBalance = async () => {
    setLoading(true)
    try {
      console.log('[SparkWallet] Manual sync & refresh...')
      await sparkService.syncWallet()
      await refreshWalletState() // Refresh provider state
      const info = await sparkService.getInfo(false)
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
      const response = await sparkService.receivePayment(amount, `Payment requested: ${amount} sats`)
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
      const result = await sparkService.sendPayment(paymentRequest, amountToSend)
      toast.success('Payment sent successfully')

      // Refresh balance and payment list immediately
      await refreshWalletState()
      loadPayments(true)

      // Poll for payment status updates for up to 10 seconds
      // This handles cases where the payment is pending and needs time to settle
      const paymentId = (result as any).id
      let pollCount = 0
      const maxPolls = 10

      const pollInterval = setInterval(async () => {
        pollCount++
        console.log(`[SparkWallet] Polling payment status (${pollCount}/${maxPolls})...`)

        // Sync wallet and reload payments to check for status updates
        try {
          await sparkService.syncWallet()
          await refreshWalletState()

          // Get updated payment list to check status
          const updatedPayments = await sparkService.listPayments(0, 20)
          const sentPayment = updatedPayments.find(p => p.id === paymentId)

          if (sentPayment) {
            console.log(`[SparkWallet] Payment status: ${sentPayment.status}`)

            // Stop polling if payment is no longer pending
            if (sentPayment.status !== 'pending') {
              clearInterval(pollInterval)
              console.log('[SparkWallet] Payment finalized, stopped polling')
              loadPayments(true)
              return
            }
          }

          loadPayments(true)
        } catch (error) {
          console.error('[SparkWallet] Error during payment status poll:', error)
        }

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval)
          console.log('[SparkWallet] Stopped polling payment status (timeout)')
        }
      }, 1000) // Poll every 1 second

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
        console.error('[SparkWallet] Error checking username:', error)
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
      console.log('[SparkWallet] Setting Lightning address:', newLightningUsername)
      const result = await sparkService.setLightningAddress(newLightningUsername)
      console.log('[SparkWallet] Lightning address set successfully:', result.lightningAddress)

      await refreshWalletState() // Refresh provider state
      console.log('[SparkWallet] Provider state refreshed')

      setEditingLightningAddress(false)
      setNewLightningUsername('')
      toast.success(`Lightning address updated to ${result.lightningAddress}`)

      // Sync to Nostr profile with confirmation
      if (publish && profileEvent && window.confirm(`Update your Nostr profile with Lightning address ${result.lightningAddress}?`)) {
        console.log('[SparkWallet] Syncing Lightning address to Nostr profile...')
        try {
          await sparkProfileSync.syncLightningAddressToProfile(
            result.lightningAddress,
            profileEvent,
            publish,
            updateProfileEvent
          )
          console.log('[SparkWallet] Lightning address synced to Nostr profile')
        } catch (syncError) {
          console.error('[SparkWallet] Failed to sync to Nostr profile:', syncError)
          const errorMessage = syncError instanceof Error ? syncError.message : String(syncError)
          console.error('[SparkWallet] Sync error details:', errorMessage)
          toast.warning(`Lightning address is active, but couldn't update your Nostr profile: ${errorMessage}. You can manually add it to your profile later.`)
        }
      }
    } catch (error) {
      console.error('[SparkWallet] Failed to set Lightning address:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to change Lightning address: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncToProfile = async () => {
    if (!providerLightningAddress || !publish || !profileEvent) {
      toast.error('Unable to sync - missing Lightning address or Nostr profile')
      return
    }

    setLoading(true)
    try {
      console.log('[SparkWallet] Manually syncing Lightning address to Nostr profile...')
      await sparkProfileSync.syncLightningAddressToProfile(
        providerLightningAddress,
        profileEvent,
        publish,
        updateProfileEvent
      )
      toast.success('Lightning address synced to your Nostr profile!')
      console.log('[SparkWallet] Successfully synced to profile')
    } catch (error) {
      console.error('[SparkWallet] Failed to sync to profile:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to sync: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLightningAddress = async () => {
    if (!window.confirm('⚠️ Delete your Lightning address from Breez?\n\nThis will unregister your Lightning address. You can register a new one later, but this username may become available to others.\n\nYour wallet and funds will not be affected.')) return

    setLoading(true)
    try {
      await sparkService.deleteLightningAddress()
      await refreshWalletState() // Refresh provider state
      toast.success('Lightning address deleted from Breez')
    } catch (error) {
      console.error('[SparkWallet] Failed to delete Lightning address:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to delete Lightning address: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  // Create new wallet with backup options
  const handleCreateNewWallet = async () => {
    if (!pubkey || !nip44Encrypt) {
      console.error('[SparkWallet] Missing pubkey or nip44Encrypt')
      toast.error('Please sign in with Nostr first')
      return
    }

    setConnecting(true)
    try {
      console.log('[SparkWallet] Step 1: Generating mnemonic...')
      // Generate new mnemonic
      const newMnemonic = sparkBackup.generateMnemonic()
      setGeneratedMnemonic(newMnemonic)
      console.log('[SparkWallet] Mnemonic generated successfully')

      console.log('[SparkWallet] Step 2: Connecting wallet...')
      // Connect wallet
      await handleConnect(newMnemonic)
      console.log('[SparkWallet] Wallet connected successfully')

      // Offer backup options
      setBackingUp(true)
      toast.success('Wallet created! Creating backups...')

      try {
        console.log('[SparkWallet] Step 3: Downloading backup file...')
        // Download encrypted backup file (using NIP-44)
        await sparkBackup.downloadBackupFile(newMnemonic, pubkey, nip44Encrypt)
        toast.success('Backup file downloaded!')
        console.log('[SparkWallet] Backup file downloaded')
      } catch (backupError) {
        console.error('[SparkWallet] Backup file download failed:', backupError)
        // Don't fail the whole process if backup download fails
        toast.error('Backup file download failed, but wallet is connected')
      }

      // Note: Relay backup is now opt-in, not automatic
      // User must explicitly enable it in settings
      console.log('[SparkWallet] Relay backup is opt-in - skipping automatic upload')
    } catch (error) {
      console.error('[SparkWallet] Failed to create wallet:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`Wallet creation failed: ${errorMessage || 'Unknown error'}`)
    } finally {
      setConnecting(false)
      setBackingUp(false)
    }
  }

  // Restore from backup file
  const handleRestoreFromFile = async () => {
    if (!pubkey || !nip44Decrypt) return

    setConnecting(true)
    setWaitingForFileSelection(true)

    // Create abort mechanism
    let aborted = false
    fileSelectionAbortRef.current = () => {
      aborted = true
      setConnecting(false)
      setWaitingForFileSelection(false)
      console.log('[SparkWallet] File selection manually cancelled')
    }

    try {
      // Pass both nip44Decrypt (primary) and nip04Decrypt (for legacy v1 backups)
      const mnemonic = await sparkBackup.restoreFromFile(pubkey, nip44Decrypt, nip04Decrypt)

      if (aborted) {
        console.log('[SparkWallet] Operation was aborted, stopping')
        return
      }

      setWaitingForFileSelection(false)
      await handleConnect(mnemonic)

      // Simple success message - handleConnect() already provided Lightning address feedback
      toast.success('Wallet restored successfully!')

      // Show reminder to register Lightning address if they don't have one
      const addr = await sparkService.getLightningAddress()
      if (!addr?.lightningAddress) {
        setTimeout(() => {
          toast.info('Tip: Register a Lightning address in Settings to receive payments easily')
          setActiveTab('payments') // Reset to payments tab but show the Register button prominently
        }, 1000)
      }
    } catch (error) {
      if (aborted) {
        console.log('[SparkWallet] Operation was aborted, ignoring error')
        return
      }

      setWaitingForFileSelection(false)
      const errorMsg = (error as Error).message

      // Don't show error toast if user cancelled the file selection
      if (errorMsg === 'File selection cancelled') {
        console.log('[SparkWallet] File restoration cancelled by user')
        return
      }

      console.error('[SparkWallet] Failed to restore from file:', error)
      toast.error(`Restore failed: ${errorMsg}`)
    } finally {
      setConnecting(false)
      setWaitingForFileSelection(false)
      fileSelectionAbortRef.current = null
    }
  }

  // Cancel file selection
  const handleCancelFileSelection = () => {
    if (fileSelectionAbortRef.current) {
      fileSelectionAbortRef.current()
    }
  }

  // Restore from relays
  const handleRestoreFromRelays = async () => {
    if (!pubkey) return

    setConnecting(true)
    try {
      const mnemonic = await sparkBackup.loadFromNostr()
      if (!mnemonic) {
        toast.error('No backup found on your relays')
        return
      }
      await handleConnect(mnemonic)

      // Simple success message - handleConnect() already provided Lightning address feedback
      toast.success('Wallet restored successfully!')

      // Show reminder to register Lightning address if they don't have one
      const addr = await sparkService.getLightningAddress()
      if (!addr?.lightningAddress) {
        setTimeout(() => {
          toast.info('Tip: Register a Lightning address in Settings to receive payments easily')
        }, 1000)
      }
    } catch (error) {
      console.error('[SparkWallet] Failed to restore from relays:', error)
      toast.error(`Restore failed: ${(error as Error).message}`)
    } finally {
      setConnecting(false)
    }
  }

  // Check which relays have the backup
  const handleCheckBackupLocations = async () => {
    if (!pubkey) {
      toast.error('Please sign in with Nostr first')
      return
    }

    setCheckingBackupLocations(true)
    try {
      console.log('[SparkWallet] Checking backup locations...')
      const locations = await sparkBackup.checkBackupAvailability()
      setBackupLocations(locations)
      setShowBackupLocations(true)

      const availableCount = Object.values(locations).filter(Boolean).length
      const totalCount = Object.keys(locations).length
      toast.success(`Backup found on ${availableCount} of ${totalCount} relays`)
      console.log('[SparkWallet] Backup locations:', locations)
    } catch (error) {
      console.error('[SparkWallet] Failed to check backup locations:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to check backup locations: ${errorMsg}`)
    } finally {
      setCheckingBackupLocations(false)
    }
  }

  // Check encryption version of backup
  const handleCheckEncryptionVersion = async () => {
    if (!pubkey) return

    try {
      const version = await sparkBackup.getBackupEncryptionVersion()
      setBackupEncryptionVersion(version)
    } catch (error) {
      console.error('[SparkWallet] Failed to check encryption version:', error)
    }
  }

  // Re-sync backup to current relays
  const handleResyncBackupToRelays = async () => {
    if (!pubkey) {
      toast.error('Please sign in with Nostr first')
      return
    }

    if (!publish) {
      toast.error('Publish function not available')
      return
    }

    setResyncingBackup(true)
    try {
      console.log('[SparkWallet] Re-syncing backup to relays...')

      // Load mnemonic from storage (already decrypted)
      const mnemonic = await sparkStorage.loadMnemonic(pubkey)
      if (!mnemonic) {
        toast.error('No wallet found in storage')
        return
      }

      // Re-publish to current relays
      console.log('[SparkWallet] Publishing backup to current relays...')
      await sparkBackup.saveToNostr(mnemonic)

      toast.success('Backup synced to your current relays!')
      console.log('[SparkWallet] Backup synced successfully')

      // Re-check encryption version and locations after sync
      handleCheckEncryptionVersion()
      if (showBackupLocations) {
        setTimeout(() => handleCheckBackupLocations(), 1000)
      }
    } catch (error) {
      console.error('[SparkWallet] Failed to sync backup:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to sync backup: ${errorMsg}`)
    } finally {
      setResyncingBackup(false)
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={
      <div className="flex items-center gap-2">
        <span>Spark Wallet</span>
        <span className="text-sm text-muted-foreground font-normal">powered by Breez SDK</span>
      </div>
    }>
      {/* Lightning animation overlay */}
      {showLightning && <CodepenLightning duration={1000} active={showLightning} />}

      <div className="px-4 pt-3 space-y-6">
        {!pubkey && (
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg">
            <p className="text-sm text-yellow-900 dark:text-yellow-200">
              Please sign in with your Nostr profile first to use Spark wallet
            </p>
          </div>
        )}

        {pubkey && hasSavedWallet && !connected && connecting && (
          <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-400 rounded-lg space-y-2">
            <p className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Loader2 className="animate-spin size-4" />
              Connecting wallet...
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Loading your saved wallet from secure storage
            </p>
          </div>
        )}

        {!connected && pubkey && !hasSavedWallet ? (
          <div className="space-y-4">
            {setupMode === 'choose' && (
              <>
                <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-400 rounded-lg">
                  <p className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Set up your Spark Wallet</p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Choose how you'd like to set up your wallet
                  </p>
                </div>

                {/* Show notification if relay backup is found */}
                {checkingRelayBackup && (
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg">
                    <p className="text-sm text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
                      <Loader2 className="animate-spin size-4" />
                      Checking for existing wallet backup...
                    </p>
                  </div>
                )}

                {!checkingRelayBackup && hasRelayBackup && (
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 border border-green-400 rounded-lg">
                    <p className="font-semibold text-green-900 dark:text-green-200 mb-1 flex items-center gap-2">
                      <CheckCircle className="size-4" /> Wallet Backup Found!
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-300">
                      We found an existing wallet backup on your Nostr relays. Click "Restore from Relays" below to access your wallet.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Always recommend "Create New Wallet" for new users */}
                  <Button onClick={handleCreateNewWallet} disabled={connecting || backingUp} className="w-full h-auto py-3 flex-col items-start">
                    <span className="font-semibold flex items-center gap-2"><PlusCircle className="size-4" /> Create New Wallet (Recommended)</span>
                    <span className="text-xs opacity-80">Generates new wallet with encrypted backups</span>
                  </Button>

                  <Button onClick={handleRestoreFromFile} disabled={connecting} variant="outline" className="w-full h-auto py-3 flex-col items-start">
                    <span className="font-semibold flex items-center gap-2"><FolderOpen className="size-4" /> Restore from Backup File</span>
                    <span className="text-xs opacity-80">Use your encrypted backup.json file</span>
                  </Button>

                  {/* Show recommendation if relay backup exists */}
                  <Button onClick={handleRestoreFromRelays} disabled={connecting} variant="outline" className={`w-full h-auto py-3 flex-col items-start ${hasRelayBackup ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/20' : ''}`}>
                    <span className={`font-semibold flex items-center gap-2 ${hasRelayBackup ? 'text-green-700 dark:text-green-400' : ''}`}>
                      <Cloud className="size-4" /> Restore from Relays{hasRelayBackup && ' ✓'}
                    </span>
                    <span className="text-xs opacity-80">
                      {hasRelayBackup ? 'Backup found on your relays!' : 'Fetch backup from Nostr relays'}
                    </span>
                  </Button>

                  <Button onClick={() => setSetupMode('manual')} disabled={connecting} variant="ghost" className="w-full h-auto py-3 flex-col items-start border border-dashed">
                    <span className="font-semibold text-yellow-600 dark:text-yellow-500 flex items-center gap-2"><AlertTriangle className="size-4" /> Manual Seed Phrase Entry</span>
                    <span className="text-xs opacity-80">Less secure - be sure no one is watching</span>
                  </Button>
                </div>

                {(connecting || backingUp) && (
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 border border-blue-400 rounded-lg">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                        <Loader2 className="animate-spin size-4" />
                        {backingUp
                          ? 'Creating encrypted backups...'
                          : waitingForFileSelection
                            ? 'Waiting for file selection...'
                            : 'Setting up wallet...'}
                      </p>
                      {waitingForFileSelection && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelFileSelection}
                          className="h-auto py-1 px-2 text-xs text-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {setupMode === 'manual' && (
              <>
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg">
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1 flex items-center gap-1.5"><AlertTriangle className="size-4" /> Security Warning</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Entering your seed phrase into a website is not recommended. Use backup files or relay backups instead.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mnemonic">Recovery Phrase</Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowMnemonic(!showMnemonic)} className="h-auto p-1">
                      {showMnemonic ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                  <textarea
                    id="mnemonic"
                    placeholder="Enter your 12 or 24 word recovery phrase"
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                    style={{ WebkitTextSecurity: showMnemonic ? 'none' : 'disc' } as React.CSSProperties}
                  />
                  <p className="text-xs text-muted-foreground">Words should be separated by spaces</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setSetupMode('choose')} variant="outline" className="flex-1">
                    Back
                  </Button>
                  <Button onClick={() => handleConnect()} disabled={connecting || !mnemonic.trim()} className="flex-1">
                    {connecting && <Loader2 className="animate-spin" />}
                    Connect
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : connected ? (
          <>
            {generatedMnemonic && (
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200 flex items-center gap-1.5">
                    <AlertTriangle className="size-4" /> Save Your Recovery Phrase!
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Show warning when revealing, just toggle when hiding
                        if (!showGeneratedMnemonic) {
                          if (confirm('⚠️ Warning: Your recovery phrase gives full access to your wallet!\n\nOnly reveal this in a secure, private location.\n\nAnyone with these 12 words can access your funds.\n\nDo you want to continue?')) {
                            setShowGeneratedMnemonic(true)
                          }
                        } else {
                          setShowGeneratedMnemonic(false)
                        }
                      }}
                      className="h-auto p-1"
                    >
                      {showGeneratedMnemonic ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('⚠️ Have you safely stored your recovery phrase?\n\nWithout it, you cannot recover your wallet if you lose access to this device or your backup files.\n\nMake sure you have either:\n- Written down the 12 words\n- Downloaded the encrypted backup file\n- Saved the backup to your Nostr relays')) {
                          setGeneratedMnemonic('')
                        }
                      }}
                      className="h-auto p-1"
                      title="Dismiss"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
                {showGeneratedMnemonic ? (
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-mono break-words whitespace-pre-wrap">
                    {generatedMnemonic}
                  </p>
                ) : (
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Click the eye icon to reveal your recovery phrase
                  </p>
                )}
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Write this down securely. You'll need it to recover your wallet if you lose your backup files.
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
                {providerBalance !== null ? `${providerBalance.toLocaleString()} sats` : 'Loading...'}
              </p>

              {/* Show Lightning address if registered, otherwise show link to register */}
              {providerLightningAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-base font-mono break-all text-foreground">
                      {providerLightningAddress}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(providerLightningAddress)
                        toast.success('Lightning address copied!')
                      }}
                      className="h-auto p-1 shrink-0"
                      title="Copy Lightning address"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLightningAddressQR(!showLightningAddressQR)}
                      className="h-auto p-1 shrink-0"
                      title="Show QR code"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="5" height="5" x="3" y="3" rx="1"/>
                        <rect width="5" height="5" x="16" y="3" rx="1"/>
                        <rect width="5" height="5" x="3" y="16" rx="1"/>
                        <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                        <path d="M21 21v.01"/>
                        <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                        <path d="M3 12h.01"/>
                        <path d="M12 3h.01"/>
                        <path d="M12 16v.01"/>
                        <path d="M16 12h1"/>
                        <path d="M21 12v.01"/>
                        <path d="M12 21v-1"/>
                      </svg>
                    </Button>
                  </div>
                  {showLightningAddressQR && (
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLightningAddressQR(false)}
                        className="absolute top-2 right-2 h-auto p-1"
                        title="Close QR code"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </Button>
                      <div className="flex justify-center">
                        <div ref={lightningAddressQRRef} className="flex items-center justify-center" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setShowSettings(true)
                      setTimeout(() => {
                        lightningAddressSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center'
                        })
                      }, 100)
                    }}
                    className="h-auto p-0 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <span className="flex items-center gap-1.5"><Zap className="size-3.5" /> Get a Lightning Address</span>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set up a Lightning address to receive payments easily
                  </p>
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
                  <SparkPaymentsList
                    payments={payments}
                    loading={loadingPayments}
                    onRefreshPayment={refreshPayment}
                  />

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
                        {(providerBalance || 0) + topUpAmount > 100000 && (
                          <span className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="size-3" /> Hot wallet
                          </span>
                        )}
                      </div>

                      {/* Preset Amounts - 2 column grid like Fountain */}
                      <div className="grid grid-cols-2 gap-3">
                        {[1000, 5000, 10000, 20000, 50000, 100000].map((amount) => {
                          const currentBalance = providerBalance || 0
                          const maxAllowed = 500000
                          const remainingCapacity = maxAllowed - currentBalance
                          const wouldExceedLimit = amount > remainingCapacity

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
                        variant={showCustomInput ? 'default' : 'outline'}
                        size="lg"
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className="w-full h-auto py-4 flex items-center justify-between"
                      >
                        <span className="text-lg">Custom</span>
                        <Pencil className="size-4 text-muted-foreground" />
                      </Button>

                      {/* Custom Amount Input - Inline */}
                      {showCustomInput && (
                        <div className="p-4 bg-muted/50 rounded-lg space-y-2 animate-in slide-in-from-top-2">
                          <Label className="text-sm">Enter custom amount</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Amount in sats"
                              value={topUpAmount}
                              onChange={(e) => {
                                const currentBalance = providerBalance || 0
                                const maxAllowed = 500000
                                const remainingCapacity = maxAllowed - currentBalance
                                const val = parseInt(e.target.value) || 0
                                setTopUpAmount(Math.min(Math.max(val, 0), remainingCapacity))
                              }}
                              className="flex-1"
                              min="0"
                              max={500000 - (providerBalance || 0)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCustomInput(false)}
                            >
                              Done
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Max: {(500000 - (providerBalance || 0)).toLocaleString()} sats remaining
                          </p>
                        </div>
                      )}

                      {/* Safety Warning */}
                      {(providerBalance || 0) + topUpAmount > 100000 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded text-xs">
                          <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5" /> Hot Wallet Warning
                          </p>
                          <p className="text-amber-800 dark:text-amber-300 mt-1">
                            Hot wallets should not contain large balances. Consider keeping less than 100k sats for daily use.
                          </p>
                        </div>
                      )}

                      {/* Balance Limit Warning */}
                      {(providerBalance || 0) + topUpAmount > 500000 && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 rounded text-xs">
                          <p className="font-semibold text-red-900 dark:text-red-200">
                            Maximum Balance Exceeded
                          </p>
                          <p className="text-red-800 dark:text-red-300 mt-1">
                            Total balance would be {((providerBalance || 0) + topUpAmount).toLocaleString()} sats.
                            Maximum allowed is 500,000 sats.
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={() => handleGenerateInvoice(topUpAmount)}
                        disabled={loading || topUpAmount === 0 || (providerBalance || 0) + topUpAmount > 500000}
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
                <span className="text-sm flex items-center gap-1.5"><Settings className="size-4" /> Wallet Settings</span>
                {showSettings ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>

              {showSettings && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  {/* Lightning Address Management */}
                  <div className="space-y-2" ref={lightningAddressSectionRef}>
                    <Label className="text-sm">Lightning Address</Label>
                    {!editingLightningAddress ? (
                      <div className="flex items-center gap-2">
                        {providerLightningAddress ? (
                          <>
                            <div className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                              {providerLightningAddress}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSyncToProfile}
                              disabled={loading}
                              title="Sync Lightning address to your Nostr profile"
                            >
                              Sync to Profile
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingLightningAddress(true)
                                setNewLightningUsername(providerLightningAddress.split('@')[0])
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
                            className="w-full relative bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-300 dark:border-blue-700 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 before:absolute before:inset-0 before:rounded-md before:animate-pulse before:border-2 before:border-blue-400 dark:before:border-blue-500 before:pointer-events-none"
                          >
                            <span className="flex items-center gap-1.5"><Zap className="size-4" /> Get Lightning Address</span>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="username"
                            value={newLightningUsername}
                            onChange={(e) => {
                              // Only allow valid LUD-16 username characters: lowercase letters, numbers, hyphen, underscore, period
                              const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '')
                              setNewLightningUsername(sanitized)
                            }}
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

                  {/* Zap Settings */}
                  <div className="space-y-4 pt-2 border-t">
                    <Label className="text-sm">Zap Settings</Label>
                    <DefaultZapAmountInput />
                    <DefaultZapCommentInput />
                    <QuickZapSwitch />
                  </div>

                  {/* Wallet Sidebar Settings */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wallet-sidebar" className="text-sm cursor-pointer">Show Wallet in Sidebar</Label>
                      <Switch
                        id="wallet-sidebar"
                        checked={showWalletInSidebar}
                        onCheckedChange={updateShowWalletInSidebar}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Display wallet balance in the left sidebar for quick access
                    </p>
                  </div>

                  {/* Nostr Wallet Connect */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Nostr Wallet Connect</Label>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                        Coming Soon
                      </span>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-dashed space-y-3">
                      <div className="flex items-center gap-3">
                        <img
                          src="/nwc-icon.svg"
                          alt="NWC"
                          className="size-8"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Create Wallet Connections</p>
                          <p className="text-xs text-muted-foreground">
                            Connect your wallet to other Nostr apps with customizable permissions
                          </p>
                        </div>
                      </div>
                      <a
                        href="https://nwc.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Learn more about Nostr Wallet Connect →
                      </a>
                    </div>
                  </div>

                  {/* Backup & Remove Wallet */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">Wallet Backup & Recovery</Label>

                    <Button
                      onClick={handleRevealRecoveryPhrase}
                      variant="outline"
                      className="w-full"
                      size="sm"
                      disabled={loading}
                    >
                      <span className="flex items-center gap-1.5"><Key className="size-4" /> Reveal Recovery Phrase</span>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Show your 12-word recovery phrase. Write it down and store it securely offline.
                    </p>

                    {revealedMnemonic && (
                      <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-yellow-900 dark:text-yellow-200 flex items-center gap-1.5">
                            <AlertTriangle className="size-4" /> Your Recovery Phrase
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Show warning when revealing, just toggle when hiding
                                if (!showRevealedMnemonic) {
                                  if (confirm('⚠️ Warning: Your recovery phrase gives full access to your wallet!\n\nOnly reveal this in a secure, private location.\n\nAnyone with these 12 words can access your funds.\n\nDo you want to continue?')) {
                                    setShowRevealedMnemonic(true)
                                  }
                                } else {
                                  setShowRevealedMnemonic(false)
                                }
                              }}
                              className="h-auto p-1"
                            >
                              {showRevealedMnemonic ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('⚠️ Hide recovery phrase?\n\nMake sure you have written it down or stored it safely before hiding.')) {
                                  setRevealedMnemonic('')
                                  setShowRevealedMnemonic(false)
                                }
                              }}
                              className="h-auto p-1"
                              title="Hide"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                        {showRevealedMnemonic ? (
                          <p className="text-sm text-yellow-800 dark:text-yellow-300 font-mono break-words whitespace-pre-wrap">
                            {revealedMnemonic}
                          </p>
                        ) : (
                          <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            Click the eye icon to reveal your recovery phrase
                          </p>
                        )}
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">
                          Write this down and store it securely. Anyone with these words can access your funds.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleDownloadBackup}
                      variant="outline"
                      className="w-full"
                      size="sm"
                      disabled={loading}
                    >
                      <span className="flex items-center gap-1.5"><Download className="size-4" /> Download Encrypted Backup File</span>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Download an encrypted backup file. Easier to store than writing down 12 words.
                    </p>

                    {/* Relay Backup Management */}
                    <div className="space-y-2 pt-2">
                      {/* Encryption Version Indicator */}
                      {backupEncryptionVersion && (
                        <div className={`flex items-center gap-2 text-xs p-2 rounded ${
                          backupEncryptionVersion === 'nip44'
                            ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                            : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                        }`}>
                          <span className="font-medium">
                            {backupEncryptionVersion === 'nip44' ? '✓ NIP-44 Encryption' : '⚠️ NIP-04 (Legacy)'}
                          </span>
                          {backupEncryptionVersion === 'nip04' && (
                            <span className="text-xs opacity-80">Will auto-upgrade on next load</span>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={handleResyncBackupToRelays}
                        variant="outline"
                        className="w-full"
                        size="sm"
                        disabled={resyncingBackup || !publish}
                      >
                        {resyncingBackup ? (
                          <>
                            <Loader2 className="animate-spin size-4 mr-2" />
                            Syncing...
                          </>
                        ) : (
                          <span className="flex items-center gap-1.5"><Cloud className="size-4" /> Sync Backup to Relays</span>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Optional: Upload encrypted backup to Nostr relays for multi-device access. Syncs to your current relay list.
                      </p>

                      {/* Expandable backup locations section */}
                      <div className="pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!showBackupLocations) {
                              handleCheckBackupLocations()
                            } else {
                              setShowBackupLocations(false)
                            }
                          }}
                          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground"
                          disabled={checkingBackupLocations}
                        >
                          <span>
                            {checkingBackupLocations ? (
                              <>
                                <Loader2 className="inline-block animate-spin size-3 mr-1" />
                                Checking backup locations...
                              </>
                            ) : (
                              'Show which relays have backup'
                            )}
                          </span>
                          {!checkingBackupLocations && (
                            showBackupLocations ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                          )}
                        </Button>

                        {showBackupLocations && Object.keys(backupLocations).length > 0 && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg border space-y-2">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Backup Status by Relay:</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {Object.entries(backupLocations).map(([relayUrl, hasBackup]) => (
                                <div
                                  key={relayUrl}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <span className={`mt-0.5 ${hasBackup ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {hasBackup ? '✓' : '✗'}
                                  </span>
                                  <span className="flex-1 font-mono text-[10px] break-all leading-relaxed">
                                    {relayUrl}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                              {Object.values(backupLocations).filter(Boolean).length} of {Object.keys(backupLocations).length} relays have your backup
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t space-y-3">
                      <Label className="text-xs text-muted-foreground">Remove Wallet</Label>

                      {/* Option 1: Keep relay backup (safer) */}
                      <div className="space-y-2">
                        <Button
                          onClick={handleRemoveWalletKeepBackup}
                          variant="outline"
                          className="w-full text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 border-orange-300 dark:border-orange-700"
                          size="sm"
                          disabled={loading}
                        >
                          <span className="flex items-center gap-1.5"><XCircle className="size-4" /> Remove & Keep Relay Backup</span>
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Removes wallet from this device only. Your relay backup is preserved and you can restore later.
                        </p>
                      </div>

                      {/* Option 2: Delete everything (dangerous) */}
                      <div className="space-y-2">
                        <Button
                          onClick={handleRemoveWalletDeleteBackup}
                          variant="outline"
                          className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border-red-400 dark:border-red-600"
                          size="sm"
                          disabled={loading}
                        >
                          <span className="flex items-center gap-1.5"><AlertTriangle className="size-4" /> Remove & Delete Relay Backup</span>
                        </Button>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          <strong>Caution:</strong> Deletes relay backup. You can only restore from backup file or recovery phrase.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="flex items-center gap-1.5"><Zap className="size-3" /> Breez SDK + Spark wallet integration</p>
          <p className="flex items-center gap-1.5"><Key className="size-3" /> Recovery phrase encrypted with XChaCha20-Poly1305</p>
          <p className="flex items-center gap-1.5"><HardDrive className="size-3" /> Saved locally on this device</p>
          <p className="flex items-center gap-1.5"><AlertTriangle className="size-3" /> Experimental - do not use with large amounts!</p>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
SparkWalletPage.displayName = 'SparkWalletPage'
export default SparkWalletPage
