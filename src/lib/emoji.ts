// NIP-30: a custom emoji shortcode must be comprised only of alphanumeric
// characters, hyphens, and underscores.
export const SHORTCODE_REGEX = /^[a-zA-Z0-9_-]+$/

/** Strip surrounding colons and whitespace from a raw shortcode input. */
export function normalizeShortcode(raw: string): string {
  return raw.trim().replace(/^:+/, '').replace(/:+$/, '').trim()
}

/** Returns a translation key describing the error, or null if valid. */
export function validateShortcode(shortcode: string): string | null {
  if (!shortcode) return 'Shortcode is required'
  if (!SHORTCODE_REGEX.test(shortcode)) {
    return 'Shortcode can only contain letters, numbers, hyphens and underscores'
  }
  return null
}

/** Returns a translation key describing the error, or null if valid. */
export function validateEmojiUrl(url: string): string | null {
  if (!url) return 'Image URL is required'
  if (!/^https?:\/\/\S+$/.test(url)) return 'Invalid image URL'
  return null
}
