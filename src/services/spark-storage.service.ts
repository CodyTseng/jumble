import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes } from '@noble/ciphers/utils.js'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import sparkBackup from './spark-backup.service'

/**
 * SparkStorageService - Secure encrypted storage for Spark wallet mnemonic
 *
 * Dual-layer storage strategy:
 * 1. Local: XChaCha20-Poly1305 encryption in localStorage (fast access)
 * 2. Nostr: NIP-04 encrypted backup on relays (multi-device sync)
 *
 * Uses XChaCha20-Poly1305 for authenticated encryption
 * Derives encryption key from user's Nostr pubkey
 */
class SparkStorageService {
  static instance: SparkStorageService
  private readonly STORAGE_KEY_PREFIX = 'spark_wallet_'

  constructor() {
    if (!SparkStorageService.instance) {
      SparkStorageService.instance = this
    }
    return SparkStorageService.instance
  }

  /**
   * Derive encryption key from Nostr pubkey
   * This ensures the mnemonic is tied to the user's Nostr account
   */
  private deriveKey(pubkey: string): Uint8Array {
    // Use SHA-256 of pubkey as encryption key (32 bytes)
    return sha256(pubkey)
  }

  /**
   * Get storage key for a specific pubkey
   */
  private getStorageKey(pubkey: string): string {
    return `${this.STORAGE_KEY_PREFIX}${pubkey}`
  }

  /**
   * Encrypt and save mnemonic to both local storage and Nostr relays
   * @param pubkey - User's Nostr public key
   * @param mnemonic - Wallet mnemonic to save
   * @param syncToNostr - Whether to also backup to Nostr relays (default: true)
   */
  async saveMnemonic(pubkey: string, mnemonic: string, syncToNostr = true): Promise<void> {
    try {
      // Derive encryption key from pubkey
      const key = this.deriveKey(pubkey)

      // Generate random nonce (24 bytes for XChaCha20)
      const nonce = randomBytes(24)

      // Encrypt mnemonic
      const cipher = xchacha20poly1305(key, nonce)
      const plaintext = new TextEncoder().encode(mnemonic)
      const ciphertext = cipher.encrypt(plaintext)

      // Store as hex: nonce || ciphertext
      const combined = new Uint8Array(nonce.length + ciphertext.length)
      combined.set(nonce, 0)
      combined.set(ciphertext, nonce.length)

      const encrypted = bytesToHex(combined)
      localStorage.setItem(this.getStorageKey(pubkey), encrypted)

      console.log('[SparkStorage] Mnemonic encrypted and saved locally for pubkey:', pubkey.slice(0, 8))

      // Also backup to Nostr relays for multi-device sync
      if (syncToNostr) {
        try {
          await sparkBackup.saveToNostr(mnemonic)
          console.log('[SparkStorage] Mnemonic also backed up to Nostr relays')
        } catch (error) {
          console.warn('[SparkStorage] Failed to backup to Nostr (local save succeeded):', error)
          // Don't throw - local save succeeded, Nostr is just a backup
        }
      }
    } catch (error) {
      console.error('[SparkStorage] Failed to save mnemonic:', error)
      throw new Error('Failed to encrypt and save mnemonic')
    }
  }

  /**
   * Load and decrypt mnemonic
   * Tries local storage first, falls back to Nostr relays if not found
   * @param pubkey - User's Nostr public key
   * @returns Decrypted mnemonic or null if not found
   */
  async loadMnemonic(pubkey: string): Promise<string | null> {
    try {
      // Try local storage first (fastest)
      const encrypted = localStorage.getItem(this.getStorageKey(pubkey))
      if (encrypted) {
        try {
          // Derive encryption key from pubkey
          const key = this.deriveKey(pubkey)

          // Parse hex: nonce || ciphertext
          const combined = hexToBytes(encrypted)
          const nonce = combined.slice(0, 24)
          const ciphertext = combined.slice(24)

          // Decrypt
          const cipher = xchacha20poly1305(key, nonce)
          const plaintext = cipher.decrypt(ciphertext)
          const mnemonic = new TextDecoder().decode(plaintext)

          console.log('[SparkStorage] Mnemonic loaded from local storage')
          return mnemonic
        } catch (decryptError) {
          console.error('[SparkStorage] Failed to decrypt local mnemonic:', decryptError)
          // Fall through to try Nostr backup
        }
      }

      // If local storage fails or doesn't exist, try Nostr relays
      console.log('[SparkStorage] No local mnemonic, checking Nostr backup...')
      const nostrMnemonic = await sparkBackup.loadFromNostr()

      if (nostrMnemonic) {
        // Save to local storage for faster future access
        console.log('[SparkStorage] Restoring from Nostr backup to local storage')
        await this.saveMnemonic(pubkey, nostrMnemonic, false) // Don't re-sync to Nostr
        return nostrMnemonic
      }

      console.log('[SparkStorage] No mnemonic found in local or Nostr storage')
      return null
    } catch (error) {
      console.error('[SparkStorage] Failed to load mnemonic:', error)
      return null
    }
  }

  /**
   * Check if mnemonic exists for pubkey
   */
  hasMnemonic(pubkey: string): boolean {
    return localStorage.getItem(this.getStorageKey(pubkey)) !== null
  }

  /**
   * Delete saved mnemonic from both local storage and Nostr relays
   * @param pubkey - User's Nostr public key
   * @param deleteFromNostr - Whether to also delete from Nostr relays (default: true)
   */
  async deleteMnemonic(pubkey: string, deleteFromNostr = true): Promise<void> {
    // Delete from local storage
    localStorage.removeItem(this.getStorageKey(pubkey))
    console.log('[SparkStorage] Mnemonic deleted from local storage for pubkey:', pubkey.slice(0, 8))

    // Also delete from Nostr relays
    if (deleteFromNostr) {
      try {
        await sparkBackup.deleteFromNostr()
        console.log('[SparkStorage] Mnemonic also deleted from Nostr relays')
      } catch (error) {
        console.warn('[SparkStorage] Failed to delete from Nostr (local delete succeeded):', error)
        // Don't throw - local delete succeeded
      }
    }
  }

  /**
   * Clear all saved mnemonics (for all pubkeys)
   */
  clearAll(): void {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(this.STORAGE_KEY_PREFIX)
    )
    keys.forEach((key) => localStorage.removeItem(key))
    console.log('[SparkStorage] All mnemonics cleared')
  }
}

const instance = new SparkStorageService()
export default instance
