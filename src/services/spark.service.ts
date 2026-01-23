import initBreezSDK, {
  BreezSdk,
  Config,
  connect,
  ConnectRequest,
  defaultConfig,
  EventListener,
  GetInfoResponse,
  LightningAddressInfo,
  ListPaymentsResponse,
  Network,
  Payment,
  ReceivePaymentResponse,
  SdkEvent,
  Seed,
  SendPaymentResponse
} from '@breeztech/breez-sdk-spark/web'

/**
 * SparkService - Wrapper for Breez Spark SDK
 *
 * This service provides a simplified interface to the Breez Spark SDK
 * for Lightning wallet functionality in the browser.
 *
 * POC Phase 1: Testing basic initialization, send/receive, and compatibility
 */
class SparkService {
  static instance: SparkService
  private sdk: BreezSdk | null = null
  private config: Config | null = null
  private initialized = false
  private connecting = false
  private currentMnemonic = '' // Store for the session
  private eventListenerId: string | null = null
  private eventCallbacks: ((event: SdkEvent) => void)[] = []

  constructor() {
    if (!SparkService.instance) {
      SparkService.instance = this
    }
    return SparkService.instance
  }

  /**
   * Initialize the Breez SDK WebAssembly module
   * Must be called before any other operations
   */
  async initializeWasm(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('[SparkService] Initializing Breez SDK WebAssembly...')
      await initBreezSDK()
      this.initialized = true
      console.log('[SparkService] WebAssembly initialized successfully')
    } catch (error) {
      console.error('[SparkService] Failed to initialize WebAssembly:', error)
      throw new Error('Failed to initialize Breez Spark SDK')
    }
  }

  /**
   * Connect to Spark SDK with credentials
   *
   * @param apiKey - Breez API key
   * @param mnemonic - 12/24 word seed phrase (for existing wallet recovery)
   * @param network - Network to connect to (mainnet or regtest)
   */
  async connect(
    apiKey: string,
    mnemonic?: string,
    network: Network = 'mainnet'
  ): Promise<{ sdk: BreezSdk; mnemonic: string }> {
    if (!this.initialized) {
      await this.initializeWasm()
    }

    if (this.connecting) {
      throw new Error('Connection already in progress')
    }

    if (this.sdk) {
      console.log('[SparkService] Already connected')
      return { sdk: this.sdk, mnemonic: this.currentMnemonic }
    }

    this.connecting = true

    try {
      console.log('[SparkService] Starting connection process...')
      console.log('[SparkService] Network:', network)
      console.log('[SparkService] API Key present:', !!apiKey)

      console.log('[SparkService] Creating configuration...')
      this.config = defaultConfig(network)
      this.config.apiKey = apiKey
      console.log('[SparkService] Config created:', {
        network: this.config.network,
        syncIntervalSecs: this.config.syncIntervalSecs,
        preferSparkOverLightning: this.config.preferSparkOverLightning
      })

      // Prepare seed
      let seed: Seed
      if (mnemonic && mnemonic.trim()) {
        // Clean and validate mnemonic
        const cleanMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ')
        const wordCount = cleanMnemonic.split(' ').length

        if (wordCount !== 12 && wordCount !== 24) {
          throw new Error(`Invalid mnemonic: expected 12 or 24 words, got ${wordCount}`)
        }

        console.log(`[SparkService] Using ${wordCount}-word mnemonic`)
        seed = { type: 'mnemonic', mnemonic: cleanMnemonic }
        this.currentMnemonic = cleanMnemonic
      } else {
        throw new Error(
          'Mnemonic is required. Please provide a 12 or 24 word BIP39 mnemonic.'
        )
      }

      // Prepare connect request
      const connectRequest: ConnectRequest = {
        config: this.config,
        seed,
        storageDir: 'juicebox-spark-wallet'
      }

      console.log('[SparkService] Connect request prepared')
      console.log('[SparkService] Storage dir:', connectRequest.storageDir)
      console.log('[SparkService] Calling SDK connect()...')

      this.sdk = await connect(connectRequest)

      console.log('[SparkService] SDK connected! Instance:', !!this.sdk)

      // Set up event listener
      await this.setupEventListener()

      // Initial sync
      console.log('[SparkService] Starting initial wallet sync...')
      await this.syncWallet()

      console.log('[SparkService] ✅ Connection complete!')
      return { sdk: this.sdk, mnemonic: this.currentMnemonic }
    } catch (error) {
      console.error('[SparkService] ❌ Connection failed with error:')
      console.error('[SparkService] Error type:', error?.constructor?.name)
      console.error('[SparkService] Error message:', error instanceof Error ? error.message : String(error))
      console.error('[SparkService] Full error:', error)

      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Spark SDK connection failed: ${error.message}`)
      } else {
        throw new Error(`Spark SDK connection failed: ${String(error)}`)
      }
    } finally {
      this.connecting = false
    }
  }


  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.sdk) {
      try {
        // Remove event listener
        if (this.eventListenerId) {
          await this.sdk.removeEventListener(this.eventListenerId)
          this.eventListenerId = null
        }
        await this.sdk.disconnect()
        console.log('[SparkService] Disconnected')
      } catch (error) {
        console.error('[SparkService] Error during disconnect:', error)
      }
    }
    this.sdk = null
    this.config = null
    this.currentMnemonic = ''
    this.eventCallbacks = []
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.sdk !== null
  }

  /**
   * Setup event listener for SDK events
   */
  private async setupEventListener(): Promise<void> {
    if (!this.sdk) return

    const listener: EventListener = {
      onEvent: (event: SdkEvent) => {
        console.log('[SparkService] SDK Event:', event.type, event)

        // Notify all registered callbacks
        this.eventCallbacks.forEach((callback) => {
          try {
            callback(event)
          } catch (error) {
            console.error('[SparkService] Error in event callback:', error)
          }
        })
      }
    }

    this.eventListenerId = await this.sdk.addEventListener(listener)
    console.log('[SparkService] Event listener registered:', this.eventListenerId)
  }

  /**
   * Register a callback for SDK events
   * @returns Unsubscribe function
   */
  onEvent(callback: (event: SdkEvent) => void): () => void {
    this.eventCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Sync wallet with the network
   */
  async syncWallet(): Promise<void> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      console.log('[SparkService] Syncing wallet...')
      await this.sdk.syncWallet({})
      console.log('[SparkService] Wallet synced')
    } catch (error) {
      console.error('[SparkService] Sync failed:', error)
      throw error
    }
  }

  /**
   * Get wallet info (balance, etc.)
   */
  async getInfo(ensureSynced = true): Promise<GetInfoResponse> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      const info = await this.sdk.getInfo({ ensureSynced })
      console.log('[SparkService] Wallet info:', info)
      return info
    } catch (error) {
      console.error('[SparkService] Failed to get info:', error)
      throw error
    }
  }

  /**
   * Generate Lightning invoice to receive payment
   *
   * @param amountSats - Amount in satoshis (optional for variable amount)
   * @param description - Invoice description
   */
  async receivePayment(
    amountSats?: number,
    description = 'Juicebox payment'
  ): Promise<ReceivePaymentResponse> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      const response = await this.sdk.receivePayment({
        paymentMethod: {
          type: 'bolt11Invoice',
          description,
          amountSats
        }
      })
      console.log('[SparkService] Invoice generated:', response.paymentRequest)
      return response
    } catch (error) {
      console.error('[SparkService] Failed to generate invoice:', error)
      throw error
    }
  }

  /**
   * Send payment via Lightning
   *
   * @param paymentRequest - Bolt11 invoice or Lightning address
   * @param amountSats - Amount (required for zero-amount invoices)
   */
  async sendPayment(
    paymentRequest: string,
    amountSats?: number
  ): Promise<SendPaymentResponse> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      // Prepare the payment
      const prepareResponse = await this.sdk.prepareSendPayment({
        paymentRequest,
        amountSats
      })

      console.log('[SparkService] Payment prepared:', prepareResponse)

      // Send the payment
      const response = await this.sdk.sendPayment({
        prepareResponse,
        options: {
          type: 'bolt11Invoice',
          preferSpark: false // Use Lightning for compatibility
        }
      })

      console.log('[SparkService] Payment sent:', response)
      return response
    } catch (error) {
      console.error('[SparkService] Payment failed:', error)
      throw error
    }
  }

  /**
   * List payment history
   */
  async listPayments(offset = 0, limit = 100): Promise<Payment[]> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      const response: ListPaymentsResponse = await this.sdk.listPayments({ offset, limit })
      return response.payments
    } catch (error) {
      console.error('[SparkService] Failed to list payments:', error)
      throw error
    }
  }

  /**
   * Register a Lightning address
   * Format: username@domain
   */
  async registerLightningAddress(username: string): Promise<LightningAddressInfo> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      const response = await this.sdk.registerLightningAddress({
        username,
        description: 'Juicebox Spark Wallet'
      })
      console.log('[SparkService] Lightning address registered:', response.lightningAddress)
      return response
    } catch (error) {
      console.error('[SparkService] Failed to register Lightning address:', error)
      throw error
    }
  }

  /**
   * Get current Lightning address if registered
   */
  async getLightningAddress(): Promise<LightningAddressInfo | null> {
    if (!this.sdk) throw new Error('SDK not connected')

    try {
      const response = await this.sdk.getLightningAddress()
      return response || null
    } catch (error) {
      console.error('[SparkService] Failed to get Lightning address:', error)
      return null
    }
  }
}

const instance = new SparkService()
export default instance
