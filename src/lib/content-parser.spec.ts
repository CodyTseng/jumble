import { describe, expect, it } from 'vitest'
import { nip19 } from 'nostr-tools'
import {
  EmbeddedEventParser,
  EmbeddedLegacyEventParser,
  EmbeddedLegacyMentionParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  parseContent
} from './content-parser'

const PUBKEY = 'ee6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74'
const EVENT_ID = 'dc0685a5b90eebbc473d19123550c032c3af596cfcec62927a7c70add5fc8c04'
const npub = nip19.npubEncode(PUBKEY)
const nevent = nip19.neventEncode({ id: EVENT_ID })
const note = nip19.noteEncode(EVENT_ID)

// Mirrors the order used by the renderers: prefixed refs, then URLs, then bare.
const PARSERS = [
  EmbeddedEventParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  EmbeddedLegacyEventParser,
  EmbeddedLegacyMentionParser
]

const parse = (content: string) => parseContent(content, PARSERS)
const types = (content: string) => parse(content).map((n) => n.type)
const find = (content: string, type: string) => parse(content).find((n) => n.type === type)

describe('bare nostr references', () => {
  it('renders a bare npub as a mention', () => {
    expect(types(`gm ${npub}`)).toContain('mention')
  })

  it('renders a bare nevent as an event', () => {
    expect(types(`look at ${nevent}`)).toContain('event')
  })

  it('renders a bare note1 as an event', () => {
    expect(types(`look at ${note}`)).toContain('event')
  })

  it('normalizes bare refs to the prefixed form so rendering is identical', () => {
    expect(find(`gm ${npub}`, 'mention')?.data).toBe(`nostr:${npub}`)
    expect(find(`gm ${nevent}`, 'event')?.data).toBe(`nostr:${nevent}`)
  })

  it('still handles prefixed refs, without doubling the prefix', () => {
    expect(find(`gm nostr:${npub}`, 'mention')?.data).toBe(`nostr:${npub}`)
    expect(find(`gm nostr:${nevent}`, 'event')?.data).toBe(`nostr:${nevent}`)
  })

  it('keeps surrounding text intact', () => {
    const nodes = parse(`before ${npub} after`)
    expect(nodes.map((n) => n.type)).toEqual(['text', 'mention', 'text'])
    expect(nodes[0].data).toBe('before ')
    expect(nodes[2].data).toBe(' after')
  })
})

describe('references that belong to a URL are left alone', () => {
  it('does not carve an npub out of an absolute URL', () => {
    const url = `https://${npub}.blossom.band/image.png`
    expect(types(url)).not.toContain('mention')
    // A lone image URL is emitted as a single `images` node; the URL must survive whole.
    expect(find(url, 'images')?.data).toEqual([url])
  })

  it('does not carve an npub out of a scheme-less host', () => {
    const url = `${npub}.blossom.band/image.png`
    // Not a URL Jumble linkifies, but it must at least stay intact as text.
    expect(parse(url)).toEqual([{ type: 'text', data: url }])
  })

  it('does not treat a ref followed by a path as a reference', () => {
    expect(types(`${npub}/image.png`)).not.toContain('mention')
  })

  it('does not match a ref glued to a preceding token', () => {
    expect(types(`x${npub}`)).not.toContain('mention')
  })

  it('still matches a ref in brackets or quotes', () => {
    expect(types(`(${npub})`)).toContain('mention')
    expect(types(`"${nevent}"`)).toContain('event')
  })

  it('still matches a ref that ends a sentence', () => {
    expect(types(`gm ${npub}.`)).toContain('mention')
  })
})

describe('invalid bech32 is not treated as a reference', () => {
  it('ignores a malformed npub', () => {
    const bad = 'npub1' + 'q'.repeat(58)
    expect(types(`gm ${bad}`)).not.toContain('mention')
  })

  it('ignores a truncated ref', () => {
    expect(types(`gm ${npub.slice(0, 30)}`)).not.toContain('mention')
  })
})
