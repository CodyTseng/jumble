import { describe, expect, it } from 'vitest'
import { getSafeExternalUrl, truncateUrl } from './url'

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

describe('truncateUrl', () => {
  it('marks omitted query parameters with an ellipsis', () => {
    expect(truncateUrl('https://example.com/path?token=secret')).toBe('example.com/path...')
    expect(truncateUrl('https://example.com?token=secret')).toBe('example.com...')
  })

  it('marks an omitted fragment with an ellipsis', () => {
    expect(truncateUrl('https://example.com/path#section')).toBe('example.com/path...')
  })

  it('keeps the display URL within the maximum length when it has an omitted suffix', () => {
    const result = truncateUrl('https://example.com/a-long-path?token=secret', 20)

    expect(result).toBe('example.com/a-lon...')
    expect(result).toHaveLength(20)
  })

  it('does not add an ellipsis when no part of the URL is omitted', () => {
    expect(truncateUrl('https://example.com/path')).toBe('example.com/path')
  })
})
