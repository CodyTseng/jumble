import { ISigner, TDraftEvent } from '@/types'
import { finalizeEvent, getPublicKey as nGetPublicKey, nip04, nip19 } from 'nostr-tools'

export class NsecSigner implements ISigner {
  private privkey: Uint8Array | null = null
  private pubkey: string | null = null

  login(nsecOrPrivkey: string | Uint8Array) {
    let privkey
    if (typeof nsecOrPrivkey === 'string') {
      const { type, data } = nip19.decode(nsecOrPrivkey)
      if (type !== 'nsec') {
        throw new Error('invalid nsec')
      }
      privkey = data
    } else {
      privkey = nsecOrPrivkey
    }

    this.privkey = privkey
    this.pubkey = nGetPublicKey(privkey)
    return this.pubkey
  }

  async getPublicKey() {
    if (!this.pubkey) {
      throw new Error('Not logged in')
    }
    return this.pubkey
  }

  async signEvent(draftEvent: TDraftEvent) {
    if (!this.privkey) {
      throw new Error('Not logged in')
    }

    return finalizeEvent(draftEvent, this.privkey)
  }

  async nip04Encrypt(pubkey: string, plainText: string) {
    if (!this.privkey) {
      throw new Error('Not logged in')
    }
    return nip04.encrypt(this.privkey, pubkey, plainText)
  }

  async nip04Decrypt(pubkey: string, cipherText: string) {
    if (!this.privkey) {
      throw new Error('Not logged in')
    }
    return nip04.decrypt(this.privkey, pubkey, cipherText)
  }
}
