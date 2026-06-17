import { isValidPubkey } from './pubkey'
import { tagNameEquals } from './tag'

// Two private contact-metadata lists on a fresh addressable kind
// (constants.ts ExtendedKind.PRIVATE_CONTACT_LIST), distinguished by d-tag.
// All entries live in NIP-44 self-encrypted content; each entry is
// ["p", pubkey, value] (no relay-hint slot). Specs: docs/nip-contact-names.md
// and docs/nip-contact-notes.md.
export const CONTACT_NAMES_D_TAG = 'contact-names'
export const CONTACT_NOTES_D_TAG = 'contact-notes'

const MAX_NAME_LENGTH = 80
const MAX_COMMENT_LENGTH = 2000

function clamp(raw: string | undefined | null, max: number): string {
  if (!raw) return ''
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()
  return stripped.length <= max ? stripped : stripped.slice(0, max).trim()
}

export const sanitizeContactName = (raw: string | undefined | null) => clamp(raw, MAX_NAME_LENGTH)
export const sanitizeContactComment = (raw: string | undefined | null) =>
  clamp(raw, MAX_COMMENT_LENGTH)

// Parse a private tag array (["p", pubkey, value]) into pubkey -> value,
// dropping empties. Used for both the names and notes lists.
export function parsePValueMap(
  tags: string[][],
  sanitize: (v: string | undefined | null) => string
): Map<string, string> {
  const map = new Map<string, string>()
  for (const tag of tags) {
    if (!tagNameEquals('p')(tag)) continue
    const pubkey = tag[1]
    if (!pubkey || !isValidPubkey(pubkey)) continue
    const value = sanitize(tag[2])
    if (value) map.set(pubkey, value)
  }
  return map
}

// pubkey -> value back into ["p", pubkey, value] tags.
export function serializePValueMap(map: Map<string, string>): string[][] {
  const tags: string[][] = []
  for (const [pubkey, value] of map) {
    if (!value) continue
    tags.push(['p', pubkey, value])
  }
  return tags
}
