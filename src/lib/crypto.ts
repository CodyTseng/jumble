import { BoundedMap } from '@/lib/bounded-map'
import { bytesToHex } from '@noble/hashes/utils'
import { v2 as nip44 } from 'nostr-tools/nip44'

/**
 * Deriving a NIP-44 conversation key runs an ECDH multiplication plus an HKDF
 * extract, which is relatively expensive. The same (privkey, pubkey) pair is
 * derived repeatedly when sending/receiving many messages in a conversation,
 * so we memoize the result.
 *
 * The cache key combines the private key (as hex) and the peer pubkey. Since
 * the derivation is symmetric per key pair, the same entry is reused across
 * encrypt and decrypt calls.
 */
const conversationKeyCache = new BoundedMap<string, Uint8Array>({ maxSize: 500 })

export function getConversationKey(privkey: Uint8Array, pubkey: string): Uint8Array {
  const cacheKey = `${bytesToHex(privkey)}:${pubkey}`
  let conversationKey = conversationKeyCache.get(cacheKey)
  if (!conversationKey) {
    conversationKey = nip44.utils.getConversationKey(privkey, pubkey)
    conversationKeyCache.set(cacheKey, conversationKey)
  }
  return conversationKey
}
