import { isValidPubkey } from './pubkey'
import { tagNameEquals } from './tag'

// The `d` identifier for our private contact-notes follow set (NIP-51 kind
// 30000). All entries live in the NIP-44-encrypted content, so to other
// clients this is an opaque/empty named set — nothing leaks.
export const CONTACT_NOTES_D_TAG = 'jumble-contact-notes'

const MAX_NAME_LENGTH = 80
const MAX_COMMENT_LENGTH = 2000

export type TContactNote = {
  pubkey: string
  // Snapshot of the contact's display name when the note was created/updated.
  // Drives rebrand detection: compare against the current kind-0 name.
  name: string
  // Freeform private annotation ("met at Alice's party", "shitcoin scammer").
  comment: string
}

function clamp(raw: string | undefined | null, max: number): string {
  if (!raw) return ''
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()
  return stripped.length <= max ? stripped : stripped.slice(0, max).trim()
}

export const sanitizeContactName = (raw: string | undefined | null) => clamp(raw, MAX_NAME_LENGTH)
export const sanitizeContactComment = (raw: string | undefined | null) =>
  clamp(raw, MAX_COMMENT_LENGTH)

// Private entry wire shape (inside the encrypted content tag array):
//   ["p", pubkey, "", name, comment]
// The 4th element is the standard NIP-02 petname slot (reused as the name
// snapshot); the 5th is our private comment extension. Both optional.
export function parseContactNotesFromPrivateTags(tags: string[][]): Map<string, TContactNote> {
  const map = new Map<string, TContactNote>()
  for (const tag of tags) {
    if (!tagNameEquals('p')(tag)) continue
    const pubkey = tag[1]
    if (!pubkey || !isValidPubkey(pubkey)) continue
    const name = sanitizeContactName(tag[3])
    const comment = sanitizeContactComment(tag[4])
    if (!name && !comment) continue
    map.set(pubkey, { pubkey, name, comment })
  }
  return map
}

export function serializeContactNotesToPrivateTags(map: Map<string, TContactNote>): string[][] {
  const tags: string[][] = []
  for (const note of map.values()) {
    const name = sanitizeContactName(note.name)
    const comment = sanitizeContactComment(note.comment)
    if (!name && !comment) continue
    tags.push(['p', note.pubkey, '', name, comment])
  }
  return tags
}
