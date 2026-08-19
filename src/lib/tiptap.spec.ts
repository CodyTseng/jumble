import { describe, expect, it, vi } from 'vitest'
import { nip19 } from 'nostr-tools'

// Pulled in transitively by tiptap.ts; it reaches localStorage at module load,
// which isn't available in the node test environment.
vi.mock('@/services/custom-emoji.service', () => ({
  default: { isCustomEmojiId: () => false }
}))

const { parseEditorJsonToText } = await import('./tiptap')

const PUBKEY = 'ee6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74'
const npub = nip19.npubEncode(PUBKEY)

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
})

describe('parseEditorJsonToText', () => {
  it('adds the nostr: prefix to a bare mention', () => {
    expect(parseEditorJsonToText(doc(`gm ${npub}`))).toBe(`gm nostr:${npub}`)
  })

  it('adds the prefix when the mention starts the note', () => {
    expect(parseEditorJsonToText(doc(`${npub} gm`))).toBe(`nostr:${npub} gm`)
  })

  it('keeps an existing prefix without doubling it', () => {
    expect(parseEditorJsonToText(doc(`gm nostr:${npub}`))).toBe(`gm nostr:${npub}`)
  })

  it('still prefixes a mention that ends a sentence', () => {
    expect(parseEditorJsonToText(doc(`gm ${npub}.`))).toBe(`gm nostr:${npub}.`)
    expect(parseEditorJsonToText(doc(`gm ${npub}. bye`))).toBe(`gm nostr:${npub}. bye`)
  })

  it('leaves a bech32 that is part of a hostname alone', () => {
    const url = `${npub}.blossom.band/image.png`
    expect(parseEditorJsonToText(doc(url))).toBe(url)
    expect(parseEditorJsonToText(doc(`see ${url} nice`))).toBe(`see ${url} nice`)
  })

  it('leaves a bech32 that is followed by a path alone', () => {
    const url = `${npub}/image.png`
    expect(parseEditorJsonToText(doc(url))).toBe(url)
  })

  it('does not touch a bech32 inside an absolute URL', () => {
    const url = `https://${npub}.blossom.band/image.png`
    expect(parseEditorJsonToText(doc(url))).toBe(url)
  })

  it('leaves invalid bech32 untouched', () => {
    expect(parseEditorJsonToText(doc('npub1notrealbech32'))).toBe('npub1notrealbech32')
  })
})
