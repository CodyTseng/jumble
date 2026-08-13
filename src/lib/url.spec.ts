import { describe, expect, it } from 'vitest'
import { getSafeExternalUrl } from './url'

describe('getSafeExternalUrl', () => {
  it.each(['https://example.com/path', 'http://127.0.0.1:8080/file'])('allows web URL %s', (url) =>
    expect(getSafeExternalUrl(url)).toBe(url)
  )

  it.each([
    'javascript:alert(document.domain)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'nostr:npub1invalid',
    '/relative/path',
    'not a URL'
  ])('blocks non-web or invalid URL %s', (url) => {
    expect(getSafeExternalUrl(url)).toBeNull()
  })
})
