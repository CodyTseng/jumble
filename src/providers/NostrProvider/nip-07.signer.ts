import { ISigner, TDraftEvent, TNip07 } from '@/types'

export class Nip07Signer implements ISigner {
  private signer: TNip07 | undefined
  private pubkey: string | null = null

  async init() {
    const checkInterval = 100
    const maxAttempts = 50

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (window.nostr) {
        this.signer = window.nostr
        return
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    throw new Error(
      'You need to install a nostr signer extension to login. Such as alby, nostr-keyx or nos2x.'
    )
  }

  async getPublicKey() {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.pubkey) {
      this.pubkey = await this.signer.getPublicKey()
    }
    return this.pubkey
  }

  async signEvent(draftEvent: TDraftEvent) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    return await this.signer.signEvent(draftEvent)
  }

  async nip04Encrypt(pubkey: string, plainText: string) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.signer.nip04?.encrypt) {
      throw new Error('The extension you are using does not support nip04 encryption')
    }
    return await this.signer.nip04.encrypt(pubkey, plainText)
  }

  async nip04Decrypt(pubkey: string, cipherText: string) {
    if (!this.signer) {
      throw new Error('Should call init() first')
    }
    if (!this.signer.nip04?.decrypt) {
      throw new Error('The extension you are using does not support nip04 decryption')
    }
    return await this.signer.nip04.decrypt(pubkey, cipherText)
  }
}
