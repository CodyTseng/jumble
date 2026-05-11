/** Namecoin NIP-05 identity resolution types */

/** Result of resolving a Namecoin name's Nostr data */
export interface NamecoinNostrResult {
  pubkey: string
  relays?: string[]
}

/** Parsed Namecoin identifier */
export interface ParsedNamecoinIdentifier {
  /** The raw Namecoin name, e.g. "d/example" or "id/alice" */
  namecoinName: string
  /** Namespace: "d" (domain) or "id" (identity) */
  namespace: 'd' | 'id'
  /** The name within the namespace, e.g. "example" */
  name: string
  /** Local part for domain namespace (from user@domain.bit), undefined for root */
  localPart?: string
  /** Original NIP-05 style address if applicable */
  originalAddress?: string
}

/** Result from ElectrumX name resolution */
export interface NameShowResult {
  /** The Namecoin name (e.g. "d/example") */
  name: string
  /** The name's current value (JSON string) */
  value: string
  /** Transaction ID of the latest name_update */
  txid: string
  /** Block height of the latest name_update */
  height: number
  /** Whether the name has expired (>36000 blocks since last update) */
  expired: boolean
  /** Blocks until expiry, or undefined if current height is unknown */
  expiresIn?: number
}
