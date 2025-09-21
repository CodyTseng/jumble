import { ISigner, TDraftEvent } from '@/types'
import { bytesToHex } from '@noble/hashes/utils'
import { BunkerSigner as NBunkerSigner, toBunkerURL } from 'nostr-tools/nip46'

export class NostrConnectionSigner implements ISigner {
  signer: NBunkerSigner | null = null
  private clientSecretKey: Uint8Array
  private pubkey: string | null = null
  private connectionString: string
  private bunkerString: string | null = null

  constructor(clientSecretKey: Uint8Array, connectionString: string) {
    this.clientSecretKey = clientSecretKey
    this.connectionString = connectionString
  }

  async login() {
    if (this.pubkey) {
      return {
        bunkerString: this.bunkerString,
        pubkey: this.pubkey
      }
    }

    this.signer = await NBunkerSigner.fromURI(this.clientSecretKey, this.connectionString, {
      onauth: (url) => {
        window.open(url, '_blank')
      }
    })
    this.bunkerString = toBunkerURL(this.signer.bp)
    this.pubkey = await this.signer.getPublicKey()
    return {
      bunkerString: this.bunkerString,
      pubkey: this.pubkey
    }
  }

  async getPublicKey() {
    if (!this.signer) {
      throw new Error('Not logged in')
    }
    if (!this.pubkey) {
      this.pubkey = await this.signer.getPublicKey()
    }
    return this.pubkey
  }

  async signEvent(draftEvent: TDraftEvent) {
    if (!this.signer) {
      throw new Error('Not logged in')
    }
    return this.signer.signEvent(draftEvent)
  }

  async nip04Encrypt(pubkey: string, plainText: string) {
    if (!this.signer) {
      throw new Error('Not logged in')
    }
    return await this.signer.nip04Encrypt(pubkey, plainText)
  }

  async nip04Decrypt(pubkey: string, cipherText: string) {
    if (!this.signer) {
      throw new Error('Not logged in')
    }
    return await this.signer.nip04Decrypt(pubkey, cipherText)
  }

  getClientSecretKey() {
    return bytesToHex(this.clientSecretKey)
  }
}
