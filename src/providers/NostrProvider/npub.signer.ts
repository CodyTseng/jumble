import { ISigner } from '@/types'
import { nip19 } from 'nostr-tools'

export class NpubSigner implements ISigner {
  private pubkey: string | null = null

  login(npub: string) {
    const { type, data } = nip19.decode(npub)
    if (type !== 'npub') {
      throw new Error('invalid nsec')
    }
    this.pubkey = data
    return this.pubkey
  }

  async getPublicKey() {
    if (!this.pubkey) {
      throw new Error('Not logged in')
    }
    return this.pubkey
  }

  async signEvent(): Promise<any> {
    throw new Error('Not logged in')
  }

  async nip04Encrypt(): Promise<any> {
    throw new Error('Not logged in')
  }

  async nip04Decrypt(): Promise<any> {
    throw new Error('Not logged in')
  }

  async nip44Encrypt(): Promise<any> {
    throw new Error('Not logged in')
  }

  async nip44Decrypt(): Promise<any> {
    throw new Error('Not logged in')
  }
}
