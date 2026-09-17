import { nip19 } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { normalizeNostrReferences } from './nostr-references'

const pubkey = 'ab'.repeat(32)
const npub = nip19.npubEncode(pubkey)
const ids = [
  npub,
  nip19.nprofileEncode({ pubkey }),
  nip19.noteEncode('cd'.repeat(32)),
  nip19.neventEncode({ id: 'cd'.repeat(32) }),
  nip19.naddrEncode({ kind: 30023, pubkey, identifier: 'article' })
]

describe('normalizeNostrReferences', () => {
  it.each(ids)('prefixes the valid public identifier %s', (id) => {
    expect(normalizeNostrReferences(id)).toBe(`nostr:${id}`)
    expect(normalizeNostrReferences(`nostr:${id}`)).toBe(`nostr:${id}`)
  })

  it('recognizes Markdown punctuation and link destinations without changing whitespace', () => {
    const content = `\n  **${npub}** [author](${npub}) [author][${npub}]，${npub}。\n\n`
    expect(normalizeNostrReferences(content)).toBe(
      `\n  **nostr:${npub}** [author](nostr:${npub}) [author][nostr:${npub}]，nostr:${npub}。\n\n`
    )
  })

  it('normalizes uppercase identifiers and is idempotent', () => {
    const normalized = normalizeNostrReferences(`NOSTR:${npub.toUpperCase()}`)
    expect(normalized).toBe(`nostr:${npub}`)
    expect(normalizeNostrReferences(normalized)).toBe(normalized)
  })

  it.each([
    `${npub}.blossom.band/image.png`,
    `${npub}/image.png`,
    `https://example.com/${npub}`,
    `https://example.com/prefix_${npub}`,
    `https://${npub}.example.com`,
    `https://example.com/?id=${npub}`,
    'npub1invalid',
    nip19.nsecEncode(new Uint8Array(32).fill(1))
  ])('leaves URLs, invalid IDs and secret keys unchanged', (content) => {
    expect(normalizeNostrReferences(content)).toBe(content)
  })
})
