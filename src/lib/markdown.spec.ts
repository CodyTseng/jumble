import { nip19 } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { transformMarkdownUrl } from './markdown'

describe('transformMarkdownUrl', () => {
  it('allows ordinary web and relative URLs', () => {
    expect(transformMarkdownUrl('https://example.com/image.png')).toBe(
      'https://example.com/image.png'
    )
    expect(transformMarkdownUrl('/local/path')).toBe('/local/path')
  })

  it.each([
    'javascript:alert(document.domain)',
    'java\nscript:alert(document.domain)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)'
  ])('blocks unsafe protocol %s', (url) => {
    expect(transformMarkdownUrl(url)).toBe('')
  })

  it('converts a valid nostr URI into an internal link target', () => {
    const npub = nip19.npubEncode('0'.repeat(64))
    expect(transformMarkdownUrl(`nostr:${npub}`)).toBe(npub)
  })

  it('blocks malformed or unsupported nostr URIs', () => {
    expect(transformMarkdownUrl('nostr:npub1invalid')).toBe('')
    expect(transformMarkdownUrl(`nostr:${nip19.nsecEncode(Uint8Array.from({ length: 32 }))}`)).toBe(
      ''
    )
  })
})
