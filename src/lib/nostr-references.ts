import { nip19 } from 'nostr-tools'

/** Normalize standalone public Nostr identifiers without trimming Markdown whitespace. */
export function normalizeNostrReferences(content: string): string {
  return content.replace(
    /(^|[\s([<"'*_>，。！？、：；]|@)(?:nostr:)?((?:nevent|naddr|nprofile|npub|note)1[a-z0-9]+)/gi,
    (match: string, leading: string, id: string, offset: number) => {
      // Markdown punctuation (such as _) can also occur inside URL paths.
      if (/(?:[a-z][a-z\d+.-]*:\/\/|www\.)[^\s<>()[\]"']*$/i.test(content.slice(0, offset))) {
        return match
      }
      // IDs used as hostnames or followed by paths belong to ordinary URLs.
      if (/^(?:\.[a-zA-Z0-9-]|\/)/.test(content.slice(offset + match.length))) return match
      try {
        nip19.decode(id)
        return `${leading}nostr:${id.toLowerCase()}`
      } catch {
        return match
      }
    }
  )
}
