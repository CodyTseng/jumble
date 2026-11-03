// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { renderPomegranateBrowserPage } from './pomegranate-browser-page'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

it('closes the OAuth popup before submitting and leaves Android completion to the native host', async () => {
  const { html } = renderPomegranateBrowserPage({
    authUrl: 'https://auth.example/login/google',
    purpose: 'login',
    requestId: 'session-id',
    scriptNonce: 'nonce',
    nativeCompletion: true
  })
  document.documentElement.innerHTML = html
  const popup = { close: vi.fn() }
  const open = vi.fn(() => popup)
  const fetch = vi.fn(async () => {
    expect(popup.close).toHaveBeenCalledOnce()
    return { ok: true, json: async () => ({ done: true }) }
  })
  const browser = Object.assign(new EventTarget(), { open, location: { href: '' } })
  const script = document.querySelector('script')!.textContent!
  new Function('window', 'document', 'fetch', script)(browser, document, fetch)
  document.getElementById('continue')!.click()
  expect(open).toHaveBeenCalledWith(
    'https://auth.example/login/google',
    expect.any(String),
    expect.any(String)
  )
  const message = (origin: string, source: unknown) => {
    const event = new Event('message')
    Object.assign(event, { origin, source, data: { token: 'secret-result' } })
    browser.dispatchEvent(event)
  }
  message('https://evil.example', popup)
  message('https://auth.example', {})
  expect(fetch).not.toHaveBeenCalled()
  message('https://auth.example', popup)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  expect(fetch).toHaveBeenCalledWith(
    '/pomegranate-auth/session-id/complete',
    expect.objectContaining({ body: '{"value":"secret-result"}' })
  )
  expect(popup.close).toHaveBeenCalledOnce()
  expect(document.querySelector('a')).toBeNull()
  expect(document.getElementById('title')?.textContent).toBe('Sign in to Jumble')
  expect(browser.location.href).toBe('')
})

it('escapes script-breaking text in configurable endpoints', () => {
  const { html } = renderPomegranateBrowserPage({
    authUrl: 'https://auth.example/login/google?x=</script><script>bad()',
    purpose: 'login',
    requestId: 'id',
    scriptNonce: 'nonce'
  })
  expect(html.match(/<script/g)).toHaveLength(1)
  expect(html).toContain('\\u003c/script>')
})
