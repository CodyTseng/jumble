import { nip19 } from 'nostr-tools'

const ENCODED_IDENTIFIER_REGEX =
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
