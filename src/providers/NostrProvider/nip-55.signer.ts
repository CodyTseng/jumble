import { requestNativeSignature, type NativeSignerMethod } from '@/lib/native-signer'
import { isAndroid } from '@/lib/platform'
import type { ISigner, TDraftEvent } from '@/types'
import { getEventHash, verifyEvent, type VerifiedEvent } from 'nostr-tools'

const HEX_PUBKEY = /^[0-9a-f]{64}$/
const PACKAGE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/

export class Nip55Signer implements ISigner {
  constructor(
    private readonly pubkey: string,
    readonly packageName: string
  ) {
    if (!isAndroid()) throw new Error('NIP-55 requires the Android app')
    if (!HEX_PUBKEY.test(pubkey) || !PACKAGE_NAME.test(packageName)) {
      throw new Error('Invalid Android signer account')
    }
  }

  static async login() {
    const response = await requestNativeSignature({ type: 'get_public_key', payload: '' })
    return new Nip55Signer(response.result, response.packageName ?? '')
  }

  async getPublicKey() {
    return this.pubkey
  }

  private request(type: NativeSignerMethod, payload: string, pubkey?: string) {
    return requestNativeSignature({
      type,
      payload,
      pubkey,
      packageName: this.packageName,
      currentUser: this.pubkey
    })
  }

  async signEvent(draft: TDraftEvent): Promise<VerifiedEvent> {
    // Snapshot before crossing the native boundary; validate against exactly what
    // was requested, even if the caller edits its draft while approval is open.
    const unsigned = JSON.parse(JSON.stringify({ ...draft, pubkey: this.pubkey }))
    const id = getEventHash(unsigned)
    const response = await this.request('sign_event', JSON.stringify({ ...unsigned, id }))
    const signed = response.event
      ? JSON.parse(response.event)
      : { ...unsigned, id, sig: response.result }
    if (
      signed.pubkey !== this.pubkey ||
      signed.id !== id ||
      getEventHash(signed) !== id ||
      !verifyEvent(signed)
    ) {
      throw new Error('Android signer returned an invalid signed event')
    }
    return signed
  }

  private async crypt(type: NativeSignerMethod, pubkey: string, payload: string) {
    if (!HEX_PUBKEY.test(pubkey)) throw new Error('Invalid recipient public key')
    return (await this.request(type, payload, pubkey)).result
  }

  nip04Encrypt(pubkey: string, plainText: string) {
    return this.crypt('nip04_encrypt', pubkey, plainText)
  }

  nip04Decrypt(pubkey: string, cipherText: string) {
    return this.crypt('nip04_decrypt', pubkey, cipherText)
  }

  nip44Encrypt(pubkey: string, plainText: string) {
    return this.crypt('nip44_encrypt', pubkey, plainText)
  }

  nip44Decrypt(pubkey: string, cipherText: string) {
    return this.crypt('nip44_decrypt', pubkey, cipherText)
  }
}
