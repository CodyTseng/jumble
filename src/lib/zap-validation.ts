import { Invoice } from '@getalby/lightning-tools'
import type { NostrEvent } from 'nostr-tools'
import { getZapInfoFromEvent } from './zap-info'

/** Same receipt checks for UI lists, unread counts, and headless background alerts. */
export async function validateZapReceipt(
  receipt: NostrEvent,
  loadIssuer: (recipient: string) => Promise<string | null>
): Promise<boolean> {
  const info = getZapInfoFromEvent(receipt)
  if (!info || !info.recipientPubkey || !info.invoice) return false
  if (info.preimage) {
    try {
      if (!new Invoice({ pr: info.invoice }).validatePreimage(info.preimage)) return false
    } catch {
      return false
    }
  }
  const issuer = await loadIssuer(info.recipientPubkey)
  return !issuer || receipt.pubkey === issuer
}
