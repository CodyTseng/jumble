import { describe, expect, it } from 'vitest'
import { nip19 } from 'nostr-tools'
import {
  EmbeddedBareDomainParser,
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedHashtagParser,
  EmbeddedInlineUrlParser,
  EmbeddedLNInvoiceParser,
  EmbeddedLegacyEventParser,
  EmbeddedLegacyMentionParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from './content-parser'

const PUBKEY = 'ee6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74'
const EVENT_ID = 'dc0685a5b90eebbc473d19123550c032c3af596cfcec62927a7c70add5fc8c04'
const npub = nip19.npubEncode(PUBKEY)
const nevent = nip19.neventEncode({ id: EVENT_ID })
const note = nip19.noteEncode(EVENT_ID)
const nprofile = nip19.nprofileEncode({ pubkey: PUBKEY })

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

describe('inline URLs in profile descriptions', () => {
  const parsers = [EmbeddedInlineUrlParser, EmbeddedBareDomainParser]

  it.each([
    'https://www.youtube.com/watch?v=57EaKHJibFY',
    'https://www.youtube.com/live/bTjuvO7YV_g',
    'https://youtu.be/uHICj2v_X7M',
    'https://x.com/example/status/123',
    'https://example.com/photo.png',
    'https://example.com/audio.mp3',
    'https://example.com/video.mp4'
  ])('keeps %s as an inline link', (url) => {
    expect(parseContent(url, parsers)).toEqual([{ type: 'url', data: url }])
  })

  it('recognizes episode links with and without a scheme', () => {
    const path = 'fountain.fm/episode/6ZZJL9CebYuB49LNKLy'
    expect(parseContent(`${path}\nhttps://${path}`, parsers)).toEqual([
      { type: 'bare-url', data: path },
      { type: 'text', data: '\n' },
      { type: 'url', data: `https://${path}` }
    ])
  })

  it('preserves line breaks between consecutive image links', () => {
    expect(parseContent('https://example.com/a.png\n\nhttps://example.com/b.png', parsers)).toEqual(
      [
        { type: 'url', data: 'https://example.com/a.png' },
        { type: 'text', data: '\n\n' },
        { type: 'url', data: 'https://example.com/b.png' }
      ]
    )
  })
})

describe('HTTP URLs', () => {
  it('keeps commas inside a Google Maps URL', () => {
    const url = 'https://maps.google.com/@40.7,-74.0,15z'

    expect(parseContent(url, [EmbeddedUrlParser])).toEqual([{ type: 'url', data: url }])
  })

  it('keeps square brackets in query parameters', () => {
    const url = 'https://x.com/a?f[]=1&f[]=2#top'

    expect(parseContent(url, [EmbeddedUrlParser])).toEqual([{ type: 'url', data: url }])
  })

  it('keeps a semicolon in the URL path', () => {
    const url = 'https://x.com/p;jsessionid=1'

    expect(parseContent(url, [EmbeddedUrlParser])).toEqual([{ type: 'url', data: url }])
  })

  it('keeps dollar signs, apostrophes, pipes and carets inside a URL', () => {
    const url = "https://example.com/a$b'c|d^e"

    expect(parseContent(url, [EmbeddedUrlParser])).toEqual([{ type: 'url', data: url }])
  })

  it('also handles an http URL', () => {
    const url = 'http://example.com/a,b;session=1'

    expect(parseContent(url, [EmbeddedUrlParser])).toEqual([{ type: 'url', data: url }])
  })

  it('preserves text before and after a URL', () => {
    expect(parseContent('before https://example.com/a,b after', [EmbeddedUrlParser])).toEqual([
      { type: 'text', data: 'before ' },
      { type: 'url', data: 'https://example.com/a,b' },
      { type: 'text', data: ' after' }
    ])
  })

  it('leaves a comma followed by a space outside the URL', () => {
    // parseContent trims trailing whitespace, but the comma must remain a text node.
    expect(parseContent('https://example.com/a,b, ', [EmbeddedUrlParser])).toEqual([
      { type: 'url', data: 'https://example.com/a,b' },
      { type: 'text', data: ',' }
    ])
  })

  it('keeps two URLs separated by a comma and a space separate', () => {
    expect(
      parseContent('https://example.com/a,b, https://example.org/p;session=1', [EmbeddedUrlParser])
    ).toEqual([
      { type: 'url', data: 'https://example.com/a,b' },
      { type: 'text', data: ', ' },
      { type: 'url', data: 'https://example.org/p;session=1' }
    ])
  })

  it.each([
    '.',
    ',',
    ';',
    ':',
    "'",
    '"',
    ']',
    '!',
    '?',
    '，',
    '。',
    '；',
    '：',
    '！',
    '？',
    '】',
    '）'
  ])('leaves trailing punctuation "%s" outside the URL', (punctuation) => {
    expect(parseContent(`https://example.com/?f[]=1${punctuation}`, [EmbeddedUrlParser])).toEqual([
      { type: 'url', data: 'https://example.com/?f[]=1' },
      { type: 'text', data: punctuation }
    ])
  })
})

describe('WebSocket URLs', () => {
  it('keeps special characters inside a wss URL', () => {
    const url = "wss://relay.example.com/a$b,c;d'e|f[g]^h"

    expect(parseContent(url, [EmbeddedWebsocketUrlParser])).toEqual([
      { type: 'websocket-url', data: url }
    ])
  })

  it('also handles a ws URL', () => {
    const url = 'ws://relay.example.com/?f[]=1&f[]=2'

    expect(parseContent(url, [EmbeddedWebsocketUrlParser])).toEqual([
      { type: 'websocket-url', data: url }
    ])
  })

  it('leaves a comma followed by a space outside the URL', () => {
    // parseContent trims trailing whitespace, but the comma must remain a text node.
    expect(parseContent('wss://relay.example.com/a,b, ', [EmbeddedWebsocketUrlParser])).toEqual([
      { type: 'websocket-url', data: 'wss://relay.example.com/a,b' },
      { type: 'text', data: ',' }
    ])
  })

  it('keeps two URLs separated by a comma and a space separate', () => {
    expect(
      parseContent('wss://relay.example.com/a,b, wss://relay.example.org/p;session=1', [
        EmbeddedWebsocketUrlParser
      ])
    ).toEqual([
      { type: 'websocket-url', data: 'wss://relay.example.com/a,b' },
      { type: 'text', data: ', ' },
      { type: 'websocket-url', data: 'wss://relay.example.org/p;session=1' }
    ])
  })

  it.each([
    '.',
    ',',
    ';',
    ':',
    "'",
    '"',
    ']',
    '!',
    '?',
    '，',
    '。',
    '；',
    '：',
    '！',
    '？',
    '】',
    '）'
  ])('leaves trailing punctuation "%s" outside the URL', (punctuation) => {
    expect(
      parseContent(`wss://relay.example.com/?f[]=1${punctuation}`, [EmbeddedWebsocketUrlParser])
    ).toEqual([
      { type: 'websocket-url', data: 'wss://relay.example.com/?f[]=1' },
      { type: 'text', data: punctuation }
    ])
  })
})

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

describe('@-prefixed bare mentions', () => {
  it('renders @npub as a mention without a stray @', () => {
    expect(parse(`@${npub} gm`)).toEqual([
      { type: 'mention', data: `nostr:${npub}` },
      { type: 'text', data: ' gm' }
    ])
  })

  it('folds the @ in mid-sentence', () => {
    expect(parse(`gm @${npub}!`)).toEqual([
      { type: 'text', data: 'gm ' },
      { type: 'mention', data: `nostr:${npub}` },
      { type: 'text', data: '!' }
    ])
  })

  it('handles @nprofile', () => {
    expect(find(`gm @${nprofile}`, 'mention')?.data).toBe(`nostr:${nprofile}`)
  })

  it('does not match an @ref glued to a preceding token', () => {
    expect(parse(`user@${npub}`)).toEqual([{ type: 'text', data: `user@${npub}` }])
  })
})

describe('@-prefixed nostr mentions', () => {
  it('renders @nostr:npub as a mention without a stray @', () => {
    expect(parse(`@nostr:${npub}`)).toEqual([{ type: 'mention', data: `nostr:${npub}` }])
  })

  it('folds the @ in mid-sentence', () => {
    expect(parse(`gm @nostr:${nprofile}!`)).toEqual([
      { type: 'text', data: 'gm ' },
      { type: 'mention', data: `nostr:${nprofile}` },
      { type: 'text', data: '!' }
    ])
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

describe('bare domains', () => {
  // The note renderer's order: the bare-domain parser runs last.
  const NOTE_PARSERS = [
    EmbeddedEventParser,
    EmbeddedMentionParser,
    EmbeddedUrlParser,
    EmbeddedLNInvoiceParser,
    EmbeddedWebsocketUrlParser,
    EmbeddedLegacyEventParser,
    EmbeddedLegacyMentionParser,
    EmbeddedHashtagParser,
    EmbeddedEmojiParser,
    EmbeddedBareDomainParser
  ]
  const parseNote = (content: string) => parseContent(content, NOTE_PARSERS)
  const bareUrls = (content: string) =>
    parseNote(content)
      .filter((node) => node.type === 'bare-url')
      .map((node) => node.data)

  it('links a bare domain on any TLD, keeping the path', () => {
    expect(bareUrls('see jumble.social/notes for more')).toEqual(['jumble.social/notes'])
    expect(bareUrls('go to www.habla.news now')).toEqual(['www.habla.news'])
  })

  it('leaves explicit URLs to their existing parsers', () => {
    const nodes = parseNote('see https://jumble.social/notes')
    expect(nodes.map((node) => node.type)).toEqual(['text', 'url'])
    expect(bareUrls('relay wss://relay.damus.io')).toEqual([])
  })

  it('requires a real TLD', () => {
    expect(bareUrls('bake at 350.degreesf')).toEqual([])
    expect(bareUrls('add 1.5 cups flour')).toEqual([])
    expect(bareUrls('see example.notatld')).toEqual([])
  })

  it('leaves trailing punctuation out of the link', () => {
    expect(bareUrls('see jumble.social, please')).toEqual(['jumble.social'])
  })

  it('does not overlap with a nostr reference', () => {
    const nodes = parseNote(`${npub} and jumble.social/notes`)
    expect(nodes.map((node) => node.type)).toEqual(['mention', 'text', 'bare-url'])
  })

  it('links a scheme-less blossom URL as a whole', () => {
    const url = `${npub}.blossom.band/img.png`
    expect(parseNote(url)).toEqual([{ type: 'bare-url', data: url }])
  })

  it('does not link emails', () => {
    expect(bareUrls('write to hello@jumble.social')).toEqual([])
  })
})
