import { ISigner, TDraftEvent } from '@common/types'
import { generateSecretKey } from 'nostr-tools'
import { BunkerSigner as NBunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'

export class BunkerSigner implements ISigner {
  signer: NBunkerSigner | null = null
  clientSecretKey: Uint8Array

  constructor(clientSecretKey?: Uint8Array) {
    this.clientSecretKey = clientSecretKey ?? generateSecretKey()
  }

  async login(bunker: string): Promise<string> {
    const bunkerPointer = await parseBunkerInput(bunker)
    if (!bunkerPointer) {
      throw new Error('Invalid bunker')
    }

    this.signer = new NBunkerSigner(this.clientSecretKey, bunkerPointer, {
      onauth: (url) => {
        window.open(url, '_blank')
      }
    })
    await this.signer.connect()
    return await this.signer.getPublicKey()
  }

  async getPublicKey() {
    if (!this.signer) {
      throw new Error('Not logged in')
    }
    return this.signer.getPublicKey()
  }

  async signEvent(draftEvent: TDraftEvent) {
    if (!this.signer) {
      throw new Error('Not logged in')
    }
    return this.signer.signEvent({
      ...draftEvent,
      pubkey: await this.signer.getPublicKey()
    })
  }
}
