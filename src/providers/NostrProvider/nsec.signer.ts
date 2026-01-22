import { ISigner, TDraftEvent } from '@/types'
import { finalizeEvent, getPublicKey as nGetPublicKey, nip04, nip19 } from 'nostr-tools'
import * as nip44 from 'nostr-tools/nip44'

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

  async nip44Encrypt(privkey: Uint8Array, pubkey: string, plainText: string) {
    const conversationKey = nip44.v2.utils.getConversationKey(privkey, pubkey)
    return nip44.v2.encrypt(plainText, conversationKey)
  }

  async nip44Decrypt(privkey: Uint8Array, pubkey: string, cipherText: string) {
    const conversationKey = nip44.v2.utils.getConversationKey(privkey, pubkey)
    return nip44.v2.decrypt(cipherText, conversationKey)
  }
}
