import { BIG_RELAY_URLS } from '@/constants'
import client from '@/services/client.service'
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
      throw new Error('User must be logged in to save backup to Nostr')
    }

    try {
      const pubkey = await client.signer.getPublicKey()

      // Encrypt mnemonic to self using NIP-04
      const encryptedContent = await client.signer.nip04Encrypt(pubkey, mnemonic)

      // Create NIP-78 event
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

      // Publish to user's write relays
      const relayList = await client.fetchRelayList(pubkey)
      const relays = relayList.write.slice(0, 5).concat(BIG_RELAY_URLS.slice(0, 2))

      await client.publish(relays, event)

      console.log('[SparkBackup] Encrypted backup published to Nostr relays')
    } catch (error) {
      console.error('[SparkBackup] Failed to save backup to Nostr:', error)
      throw new Error('Failed to save encrypted backup to Nostr relays')
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

      await client.publish(relayList.write.slice(0, 5), deletionEvent)

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
}

const instance = new SparkBackupService()
export default instance
