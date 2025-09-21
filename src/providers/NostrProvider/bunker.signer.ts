import { ISigner, TDraftEvent } from '@/types'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { generateSecretKey } from 'nostr-tools'
import { BunkerSigner as NBunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'

export class BunkerSigner implements ISigner {
  signer: NBunkerSigner | null = null
  private clientSecretKey: Uint8Array
  private pubkey: string | null = null

  constructor(clientSecretKey?: string) {
    this.clientSecretKey = clientSecretKey ? hexToBytes(clientSecretKey) : generateSecretKey()
  }

  async login(bunker: string, isInitialConnection = true): Promise<string> {
    const bunkerPointer = await parseBunkerInput(bunker)
    if (!bunkerPointer) {
      throw new Error('Invalid bunker')
    }

    this.signer = NBunkerSigner.fromBunker(this.clientSecretKey, bunkerPointer, {
      onauth: (url) => {
        window.open(url, '_blank')
      }
    })
    if (isInitialConnection) {
      await this.signer.connect()
    }
    return await this.signer.getPublicKey()
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
