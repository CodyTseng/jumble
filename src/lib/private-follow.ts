/**
 * NIP-51 style private follows are stored as encrypted JSON tags in kind-3 content.
 * Classic NIP-02 kind-3 content is a relay preference map (JSON object). Overwriting
 * that map would destroy relay preferences, so private follows cannot be stored then.
 */
export function canStorePrivateFollowsInContent(content: string | undefined): boolean {
  if (!content) return true
  const trimmed = content.trim()
  if (!trimmed) return true
  // NIP-02 relay map starts with `{` and is plain JSON (not ciphertext).
  if (trimmed.startsWith('{') && !trimmed.includes('?iv=')) {
    try {
      JSON.parse(trimmed)
      return false
    } catch {
      return true
    }
  }
  return true
}
