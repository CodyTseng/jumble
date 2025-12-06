import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'

export class TestSigner {
  private sk = generateSecretKey()
  private pk = getPublicKey(this.sk)

  async getPublicKey() {
    return this.pk
  }

  async signEvent(draft: Parameters<typeof finalizeEvent>[0]) {
    return finalizeEvent(draft, this.sk)
  }
}
