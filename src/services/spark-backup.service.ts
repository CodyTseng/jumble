import { BIG_RELAY_URLS } from '@/constants'
import client from '@/services/client.service'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { kinds } from 'nostr-tools'

/**
 * SparkBackupService - Nostr-based encrypted backup for Spark wallet
 *
 * Uses NIP-78 (Kind 30078) for application-specific data storage
 * Encrypts mnemonic with NIP-04 (self-to-self) for multi-device sync
 *
 * Benefits over local-only storage:
 * - Multi-device wallet access
 * - Automatic cloud backup
 * - Recoverable if device is lost
 */
class SparkBackupService {
  static instance: SparkBackupService
  private readonly BACKUP_D_TAG = 'spark-wallet-backup'
  private readonly BACKUP_KIND = 30078 // NIP-78: Application-specific data

  constructor() {
    if (!SparkBackupService.instance) {
      SparkBackupService.instance = this
    }
    return SparkBackupService.instance
  }

  /**
   * Save encrypted mnemonic to Nostr relays
   * Uses NIP-04 self-encryption for privacy
   */
  async saveToNostr(mnemonic: string): Promise<void> {
    if (!client.signer) {
      console.error('[SparkBackup] No signer available')
      throw new Error('User must be logged in to save backup to Nostr')
    }

    try {
      console.log('[SparkBackup] Step 1: Getting pubkey...')
      const pubkey = await client.signer.getPublicKey()
      console.log('[SparkBackup] Pubkey obtained:', pubkey.substring(0, 8) + '...')

      // Encrypt mnemonic to self using NIP-04
      console.log('[SparkBackup] Step 2: Encrypting mnemonic with NIP-04...')
      const encryptedContent = await client.signer.nip04Encrypt(pubkey, mnemonic)
      console.log('[SparkBackup] Mnemonic encrypted successfully')

      // Create NIP-78 event
      console.log('[SparkBackup] Step 3: Signing backup event...')
      const event = await client.signer.signEvent({
        kind: this.BACKUP_KIND,
        content: encryptedContent,
        tags: [
          ['d', this.BACKUP_D_TAG], // Addressable event identifier
          ['client', 'Jumble'],
          ['description', 'Encrypted Spark wallet backup']
        ],
        created_at: Math.floor(Date.now() / 1000)
      })
      console.log('[SparkBackup] Event signed successfully, id:', event.id.substring(0, 8) + '...')

      // Publish to user's write relays
      console.log('[SparkBackup] Step 4: Fetching relay list...')
      const relayList = await client.fetchRelayList(pubkey)
      const relays = relayList.write.slice(0, 5).concat(BIG_RELAY_URLS.slice(0, 2))
      console.log('[SparkBackup] Publishing to relays:', relays)

      console.log('[SparkBackup] Step 5: Publishing event to relays...')
      await client.publishEvent(relays, event)

      console.log('[SparkBackup] ✅ Encrypted backup published to Nostr relays')
    } catch (error) {
      console.error('[SparkBackup] ❌ Failed to save backup to Nostr:', error)
      console.error('[SparkBackup] Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('[SparkBackup] Error message:', error instanceof Error ? error.message : String(error))
      console.error('[SparkBackup] Error stack:', error instanceof Error ? error.stack : 'N/A')
      throw new Error(`Failed to save encrypted backup to Nostr relays: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Load encrypted mnemonic from Nostr relays
   * Tries user's read relays + big relays for redundancy
   */
  async loadFromNostr(): Promise<string | null> {
    if (!client.signer) {
      console.log('[SparkBackup] User not logged in, cannot load from Nostr')
      return null
    }

    try {
      const pubkey = await client.signer.getPublicKey()

      // Fetch from user's read relays
      const relayList = await client.fetchRelayList(pubkey)
      const relays = relayList.read.slice(0, 5).concat(BIG_RELAY_URLS.slice(0, 2))

      // Fetch the backup event (NIP-78 addressable event)
      const events = await client.fetchEvents(relays, {
        kinds: [this.BACKUP_KIND],
        authors: [pubkey],
        '#d': [this.BACKUP_D_TAG],
        limit: 1
      })

      if (events.length === 0) {
        console.log('[SparkBackup] No backup found on Nostr relays')
        return null
      }

      // Use the most recent event
      const backupEvent = events.sort((a, b) => b.created_at - a.created_at)[0]

      // Decrypt the mnemonic
      const mnemonic = await client.signer.nip04Decrypt(pubkey, backupEvent.content)

      console.log('[SparkBackup] Backup loaded and decrypted from Nostr')
      return mnemonic
    } catch (error) {
      console.error('[SparkBackup] Failed to load backup from Nostr:', error)
      return null
    }
  }

  /**
   * Delete backup from Nostr relays
   * Publishes a deletion event (NIP-09)
   */
  async deleteFromNostr(): Promise<void> {
    if (!client.signer) {
      throw new Error('User must be logged in to delete backup')
    }

    try {
      const pubkey = await client.signer.getPublicKey()

      // Fetch the backup event to get its ID
      const relayList = await client.fetchRelayList(pubkey)
      const relays = relayList.read.slice(0, 5).concat(BIG_RELAY_URLS.slice(0, 2))

      const events = await client.fetchEvents(relays, {
        kinds: [this.BACKUP_KIND],
        authors: [pubkey],
        '#d': [this.BACKUP_D_TAG],
        limit: 1
      })

      if (events.length === 0) {
        console.log('[SparkBackup] No backup to delete')
        return
      }

      const backupEvent = events[0]

      // Create deletion event (NIP-09)
      const deletionEvent = await client.signer.signEvent({
        kind: kinds.EventDeletion,
        content: 'Spark wallet backup deleted',
        tags: [['e', backupEvent.id]],
        created_at: Math.floor(Date.now() / 1000)
      })

      await client.publishEvent(relayList.write.slice(0, 5), deletionEvent)

      console.log('[SparkBackup] Deletion event published')
    } catch (error) {
      console.error('[SparkBackup] Failed to delete backup:', error)
      throw new Error('Failed to delete backup from Nostr relays')
    }
  }

  /**
   * Check if backup exists on Nostr relays
   */
  async hasBackupOnNostr(): Promise<boolean> {
    if (!client.signer) {
      return false
    }

    try {
      const pubkey = await client.signer.getPublicKey()
      const relayList = await client.fetchRelayList(pubkey)
      const relays = relayList.read.slice(0, 5).concat(BIG_RELAY_URLS.slice(0, 2))

      const events = await client.fetchEvents(relays, {
        kinds: [this.BACKUP_KIND],
        authors: [pubkey],
        '#d': [this.BACKUP_D_TAG],
        limit: 1
      })

      return events.length > 0
    } catch (error) {
      console.error('[SparkBackup] Failed to check for backup:', error)
      return false
    }
  }

  /**
   * Generate a new 12-word BIP39 mnemonic
   */
  generateMnemonic(): string {
    const mnemonic = generateMnemonic(wordlist, 128) // 128 bits = 12 words
    console.log('[SparkBackup] New mnemonic generated')
    return mnemonic
  }

  /**
   * Create and download encrypted backup file
   * This allows offline backup storage
   */
  async downloadBackupFile(
    mnemonic: string,
    pubkey: string,
    encrypt: (pubkey: string, plaintext: string) => Promise<string>
  ): Promise<void> {
    try {
      // Encrypt the mnemonic
      const encryptedMnemonic = await encrypt(pubkey, mnemonic)

      // Create backup object
      const backup = {
        version: 1,
        type: 'spark-wallet-backup',
        pubkey,
        encryptedMnemonic,
        createdAt: Date.now(),
        createdBy: 'Jumble'
      }

      // Convert to JSON
      const backupData = JSON.stringify(backup, null, 2)

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const filename = `spark-wallet-backup-${timestamp}.json`

      // Download file
      const blob = new Blob([backupData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('[SparkBackup] Encrypted backup file downloaded:', filename)
    } catch (error) {
      console.error('[SparkBackup] Failed to download backup file:', error)
      throw new Error('Failed to create backup file')
    }
  }

  /**
   * Restore wallet from encrypted backup file
   */
  async restoreFromFile(
    pubkey: string,
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'

      let isHandled = false
      let dialogOpened = false

      // Handle file selection cancellation - check when dialog closes
      const handleCancel = () => {
        if (!isHandled) {
          isHandled = true
          console.log('[SparkBackup] File selection cancelled by user')
          reject(new Error('File selection cancelled'))
        }
      }

      // Listen for cancel event (works on some browsers)
      input.addEventListener('cancel', handleCancel)

      // Track when dialog opens and closes
      const handleFocus = () => {
        if (!dialogOpened) {
          // First focus = dialog opened
          dialogOpened = true
          // Re-add listener for when dialog closes
          window.addEventListener('focus', handleFocus, { once: true })
        } else {
          // Second focus = dialog closed
          // Wait a bit to see if file was selected
          setTimeout(() => {
            if (!isHandled && !input.files?.length) {
              handleCancel()
            }
          }, 200)
        }
      }

      window.addEventListener('focus', handleFocus, { once: true })

      input.onchange = async (e: Event) => {
        if (isHandled) return
        isHandled = true

        window.removeEventListener('focus', handleFocus)
        input.removeEventListener('cancel', handleCancel)

        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          reject(new Error('No file selected'))
          return
        }

        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const content = e.target?.result as string
            const backup = JSON.parse(content)

            // Validate backup format
            if (backup.type !== 'spark-wallet-backup') {
              throw new Error('Invalid backup file format')
            }

            if (backup.version !== 1) {
              throw new Error(`Unsupported backup version: ${backup.version}`)
            }

            // Verify backup belongs to this user
            if (backup.pubkey !== pubkey) {
              throw new Error('This backup belongs to a different user')
            }

            // Decrypt mnemonic
            const mnemonic = await decrypt(pubkey, backup.encryptedMnemonic)

            console.log('[SparkBackup] Wallet restored from backup file')
            resolve(mnemonic)
          } catch (error) {
            console.error('[SparkBackup] Failed to restore from backup file:', error)
            reject(error)
          }
        }

        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      }

      input.click()
    })
  }
}

const instance = new SparkBackupService()
export default instance
