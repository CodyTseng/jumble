import { isValidPubkey } from './pubkey'
import { tagNameEquals } from './tag'

// Two private NIP-51 follow sets (kind 30000), one per concern. Both keep all
// entries in NIP-44 self-encrypted content, so to other clients they're opaque
// empty named sets. Each entry is a standard ["p", pubkey, relay, value] tag —
// the value sits in the NIP-02 petname slot, no non-standard elements.
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

// Parse a private tag array (["p", pubkey, relay, value]) into pubkey -> value,
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
    const value = sanitize(tag[3])
    if (value) map.set(pubkey, value)
  }
  return map
}

// pubkey -> value back into ["p", pubkey, "", value] tags (relay hint left empty).
export function serializePValueMap(map: Map<string, string>): string[][] {
  const tags: string[][] = []
  for (const [pubkey, value] of map) {
    if (!value) continue
    tags.push(['p', pubkey, '', value])
  }
  return tags
}
