import { describe, expect, it } from 'vitest'
import { getSafeExternalUrl, isLocalNetworkUrl, truncateUrl } from './url'

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

describe('isLocalNetworkUrl', () => {
  it.each([
    'ws://localhost:8080',
    'wss://relay.localhost',
    'wss://umbrel.local.',
    'ws://127.23.4.5',
    'ws://0.0.0.0',
    'wss://10.1.2.3',
    'wss://172.16.0.1',
    'wss://172.31.255.255',
    'wss://192.168.1.1',
    'ws://169.254.1.1',
    'wss://[::1]',
    'ws://[::]',
    'wss://[fe80::1]',
    'wss://[febf::1]',
    'wss://[fc00::1]',
    'wss://[fd12::1]',
    'ws://[::ffff:127.0.0.1]',
    'ws://[::ffff:192.168.1.1]'
  ])('recognizes local address %s', (url) => {
    expect(isLocalNetworkUrl(url)).toBe(true)
  })

  it.each([
    'wss://relay.example',
    'wss://localhost.example',
    'wss://172.15.0.1',
    'wss://172.32.0.1',
    'wss://[2001:4860:4860::8888]',
    'wss://[::ffff:8.8.8.8]'
  ])('keeps public address %s', (url) => {
    expect(isLocalNetworkUrl(url)).toBe(false)
  })
})
