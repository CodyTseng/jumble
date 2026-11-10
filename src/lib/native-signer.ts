import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './platform'

export type NativeSignerMethod =
  | 'get_public_key'
  | 'sign_event'
  | 'nip04_encrypt'
  | 'nip04_decrypt'
  | 'nip44_encrypt'
  | 'nip44_decrypt'

export type NativeSignerRequest = {
  type: NativeSignerMethod
  payload: string
  packageName?: string
  currentUser?: string
  pubkey?: string
}

const Signer = registerPlugin<{
  request(options: NativeSignerRequest): Promise<{
    result: string
    event?: string
    packageName?: string
  }>
}>('JumbleSigner')

// Activity results share one launcher. Serialize across accounts as well as methods,
// and let a rejected request release the queue for the next operation.
let queue: Promise<unknown> = Promise.resolve()

export function requestNativeSignature(options: NativeSignerRequest) {
  if (!isAndroid()) return Promise.reject(new Error('NIP-55 requires the Android app'))
  const result = queue.then(() => Signer.request(options))
  queue = result.catch(() => {})
  return result
}
