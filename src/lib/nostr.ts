import { nip19 } from 'nostr-tools'

export const ENCODED_IDENTIFIER_REGEX =
  /(^|\s|@)(?:nostr:)?((?:nevent|naddr|nprofile|npub)1[a-zA-Z0-9]+)/g

export function normalizeNostrReferences(value: string) {
  return value.replace(ENCODED_IDENTIFIER_REGEX, (match, prefix: string, identifier: string) => {
    if (!identifier) return match

    try {
      nip19.decode(identifier)
      const normalizedPrefix = prefix === '@' ? '' : prefix
      return `${normalizedPrefix}nostr:${identifier}`
    } catch {
      return match
    }
  })
}

export function extractNostrReferences(value: string) {
  const matches = value.matchAll(ENCODED_IDENTIFIER_REGEX)
  const identifiers = new Set<string>()

  for (const match of matches) {
    const identifier = match[2]
    if (identifier) {
      identifiers.add(identifier)
    }
  }

  return Array.from(identifiers)
}
