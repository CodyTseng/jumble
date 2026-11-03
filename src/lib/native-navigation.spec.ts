import { nip19 } from 'nostr-tools'
import { describe, expect, it } from 'vitest'
import { nativeUrlToPath } from './native-navigation'

describe('nativeUrlToPath', () => {
  it('routes public Nostr identifiers without changing their relay hints', () => {
    const pubkey = 'ab'.repeat(32)
    const npub = nip19.npubEncode(pubkey)
    const note = nip19.neventEncode({ id: 'cd'.repeat(32), relays: ['wss://relay.example'] })
    expect(nativeUrlToPath(`nostr:${npub}`)).toBe(`/users/${npub}`)
    expect(nativeUrlToPath(`nostr:${note}`)).toBe(`/notes/${note}`)
  })

  it('preserves supported HTTPS routes and notification/relay query parameters', () => {
    expect(nativeUrlToPath('https://jumble.social/notes/note1test?x=1#reply')).toBe(
      '/notes/note1test?x=1#reply'
    )
    expect(nativeUrlToPath('https://jumble.social/?page=notifications')).toBe(
      '/?page=notifications'
    )
    expect(nativeUrlToPath('https://jumble.social/?r=wss%3A%2F%2Frelay.example')).toBe(
      '/?r=wss%3A%2F%2Frelay.example'
    )
    expect(nativeUrlToPath('https://jumble.social/users/npub1test')).toBe('/users/npub1test')
  })

  it('rejects unrelated hosts, credentials, insecure links, and disabled DM routes', () => {
    for (const url of [
      'https://jumble.social.evil.test/notes/test',
      'https://user:pass@jumble.social/notes/test',
      'http://jumble.social/notes/test',
      'https://jumble.social/dms/test'
    ]) {
      expect(nativeUrlToPath(url)).toBeUndefined()
    }
  })

  it('rejects private keys, malformed identifiers, and unrelated URLs', () => {
    const secret = nip19.nsecEncode(new Uint8Array(32).fill(1))
    expect(nativeUrlToPath(`nostr:${secret}`)).toBeUndefined()
    expect(nativeUrlToPath('nostr:npub1bad')).toBeUndefined()
    expect(nativeUrlToPath('https://example.com/notes/123')).toBeUndefined()
    expect(nativeUrlToPath('javascript:alert(1)')).toBeUndefined()
  })
})
