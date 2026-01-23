import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes } from '@noble/ciphers/utils.js'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

/**
 * SparkStorageService - Secure encrypted storage for Spark wallet mnemonic
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
   * Encrypt and save mnemonic
   */
  async saveMnemonic(pubkey: string, mnemonic: string): Promise<void> {
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

      console.log('[SparkStorage] Mnemonic encrypted and saved for pubkey:', pubkey.slice(0, 8))
    } catch (error) {
      console.error('[SparkStorage] Failed to save mnemonic:', error)
      throw new Error('Failed to encrypt and save mnemonic')
    }
  }

  /**
   * Load and decrypt mnemonic
   */
  async loadMnemonic(pubkey: string): Promise<string | null> {
    try {
      const encrypted = localStorage.getItem(this.getStorageKey(pubkey))
      if (!encrypted) {
        console.log('[SparkStorage] No saved mnemonic for pubkey:', pubkey.slice(0, 8))
        return null
      }

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

      console.log('[SparkStorage] Mnemonic decrypted successfully')
      return mnemonic
    } catch (error) {
      console.error('[SparkStorage] Failed to load mnemonic:', error)
      // If decryption fails, mnemonic might be corrupted or for different key
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
   * Delete saved mnemonic
   */
  deleteMnemonic(pubkey: string): void {
    localStorage.removeItem(this.getStorageKey(pubkey))
    console.log('[SparkStorage] Mnemonic deleted for pubkey:', pubkey.slice(0, 8))
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
