/**
 * Namecoin NIP-05 identity resolver
 *
 * Resolves .bit domains, d/ and id/ Namecoin names to Nostr pubkeys
 * by connecting directly to ElectrumX servers via WebSocket from the browser.
 *
 * No backend proxy needed — the browser connects to ElectrumX over ws:// or wss://
 * and performs the full scripthash-based name lookup natively.
 */

import { LRUCache } from 'lru-cache'
import type { ParsedNamecoinIdentifier, NamecoinNostrResult } from './types'
import { DEFAULT_CACHE_TTL } from './constants'
import { nameShowWithFallback } from './electrumx-ws'

// ── Identifier detection & parsing ──────────────────────────────────

/** Check if a NIP-05-style address is a Namecoin identifier */
export function isNamecoinIdentifier(address: string): boolean {
  if (!address) return false
  const lower = address.toLowerCase()
  return lower.endsWith('.bit') || lower.startsWith('d/') || lower.startsWith('id/')
}

/**
 * Parse a NIP-05 address or raw Namecoin name into its components.
 *
 * Supported formats:
 *  - alice@example.bit  → d/example, localPart=alice
 *  - _@example.bit      → d/example, root
 *  - example.bit        → d/example, root
 *  - d/example          → d/example, root
 *  - id/alice           → id/alice
 */
export function parseNamecoinIdentifier(raw: string): ParsedNamecoinIdentifier | null {
  if (!raw) return null
  const input = raw.trim().toLowerCase()

  // Direct namespace format: d/name or id/name
  if (input.startsWith('d/')) {
    const name = input.slice(2)
    if (!name) return null
    return { namecoinName: `d/${name}`, namespace: 'd', name, originalAddress: raw }
  }
  if (input.startsWith('id/')) {
    const name = input.slice(3)
    if (!name) return null
    return { namecoinName: `id/${name}`, namespace: 'id', name, originalAddress: raw }
  }

  // NIP-05 style: [user@]domain.bit
  if (input.endsWith('.bit')) {
    const atIndex = input.indexOf('@')
    let localPart: string | undefined
    let domain: string

    if (atIndex !== -1) {
      localPart = input.slice(0, atIndex)
      domain = input.slice(atIndex + 1)
      if (localPart === '_') localPart = undefined
    } else {
      domain = input
    }

    const name = domain.slice(0, -4) // remove ".bit"
    if (!name) return null

    return {
      namecoinName: `d/${name}`,
      namespace: 'd',
      name,
      localPart,
      originalAddress: raw
    }
  }

  return null
}

// ── LRU Cache ───────────────────────────────────────────────────────

const SENTINEL_NOT_FOUND: NamecoinNostrResult = { pubkey: '' }

const cache = new LRUCache<string, NamecoinNostrResult>({
  max: 200,
  ttl: DEFAULT_CACHE_TTL
})

// ── WebSocket resolution ────────────────────────────────────────────

/**
 * Resolve a parsed Namecoin identifier via WebSocket to ElectrumX.
 * Connects directly from the browser — no proxy needed.
 * Returns null if the name doesn't exist or has no Nostr data.
 */
async function resolveNamecoinViaWs(
  parsed: ParsedNamecoinIdentifier
): Promise<NamecoinNostrResult | null> {
  const result = await nameShowWithFallback(parsed.namecoinName)
  if (!result || result.expired) return null

  const value = result.value
  if (!value) return null

  let parsedValue: Record<string, unknown>
  try {
    parsedValue = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }

  return extractNostrData(parsedValue, parsed)
}

/**
 * Extract Nostr pubkey and relays from a Namecoin name value.
 *
 * d/ namespace format:
 *   {"nostr": {"names": {"alice": "hex64"}, "relays": {"hex64": ["wss://..."]}}}
 *   {"nostr": "hex64"}  (shorthand, root identity)
 *
 * id/ namespace format:
 *   {"nostr": "hex64"}
 *   {"nostr": {"pubkey": "hex64", "relays": ["wss://..."]}}
 */
function extractNostrData(
  value: Record<string, unknown>,
  parsed: ParsedNamecoinIdentifier
): NamecoinNostrResult | null {
  const nostr = value.nostr
  if (!nostr) return null

  // id/ namespace
  if (parsed.namespace === 'id') {
    if (typeof nostr === 'string' && isValidHexPubkey(nostr)) {
      return { pubkey: nostr }
    }
    if (typeof nostr === 'object' && nostr !== null) {
      const obj = nostr as Record<string, unknown>
      const pubkey = obj.pubkey
      if (typeof pubkey === 'string' && isValidHexPubkey(pubkey)) {
        const relays = Array.isArray(obj.relays) ? (obj.relays as string[]) : undefined
        return { pubkey, relays }
      }
    }
    return null
  }

  // d/ namespace
  if (typeof nostr === 'string' && isValidHexPubkey(nostr)) {
    if (!parsed.localPart) return { pubkey: nostr }
    return null
  }

  if (typeof nostr === 'object' && nostr !== null) {
    const obj = nostr as Record<string, unknown>
    const names = obj.names as Record<string, string> | undefined
    if (!names) return null

    const lookupKey = parsed.localPart || '_'
    let pubkey = names[lookupKey]

    // Fallback: bare domain with no "_" entry — use sole entry if exactly one
    if (!pubkey && !parsed.localPart) {
      const entries = Object.entries(names).filter(([, v]) => isValidHexPubkey(v))
      if (entries.length === 1) {
        pubkey = entries[0][1]
      }
    }

    if (!pubkey || !isValidHexPubkey(pubkey)) return null

    const relaysMap = obj.relays as Record<string, string[]> | undefined
    const relays = relaysMap?.[pubkey]

    return { pubkey, relays: relays?.length ? relays : undefined }
  }

  return null
}

function isValidHexPubkey(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s)
}

// ── Main resolution function ────────────────────────────────────────

/**
 * Resolve a Namecoin identifier to a Nostr pubkey.
 * Uses an in-memory LRU cache and direct WebSocket connection to ElectrumX.
 */
export async function resolveNamecoin(
  address: string
): Promise<NamecoinNostrResult | null> {
  const parsed = parseNamecoinIdentifier(address)
  if (!parsed) return null

  const cacheKey = parsed.localPart
    ? `${parsed.namecoinName}:${parsed.localPart}`
    : parsed.namecoinName

  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached === SENTINEL_NOT_FOUND ? null : cached

  try {
    const result = await resolveNamecoinViaWs(parsed)
    cache.set(cacheKey, result ?? SENTINEL_NOT_FOUND)
    return result
  } catch (err) {
    console.warn('[Namecoin] Resolution failed for', address, err)
    return null
  }
}
