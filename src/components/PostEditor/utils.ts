import { nip19 } from 'nostr-tools'

export function preprocessContent(content: string) {
  const regex = /(?<=^|\s)(nevent|naddr|nprofile|npub)[a-zA-Z0-9]+/g
  return content.replace(regex, (match) => {
    try {
      nip19.decode(match)
      return `nostr:${match}`
    } catch {
      return match
    }
  })
}
