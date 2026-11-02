import { nip19 } from 'nostr-tools'

/** Only public NIP-19 identifiers are accepted; secret-key URIs never become routes. */
export function nativeUrlToPath(url: string): string | undefined {
  if (url.startsWith('https:')) {
    try {
      const parsed = new URL(url)
      if (parsed.origin !== 'https://jumble.social' || parsed.username || parsed.password) return
      if (parsed.pathname === '/' || /^\/(notes|users|relays)(?:\/|$)/.test(parsed.pathname)) {
        return parsed.pathname + parsed.search + parsed.hash
      }
    } catch {
      /* Ignore malformed external URLs. */
    }
    return
  }
  if (!url.startsWith('nostr:')) return
  const id = url.slice('nostr:'.length).replace(/^\/\//, '')
  try {
    const { type } = nip19.decode(id)
    if (type === 'npub' || type === 'nprofile') return `/users/${id}`
    if (type === 'note' || type === 'nevent' || type === 'naddr') return `/notes/${id}`
  } catch {
    // Ignore malformed external input.
  }
}
