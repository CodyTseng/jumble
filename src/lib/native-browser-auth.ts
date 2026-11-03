import { registerPlugin } from '@capacitor/core'
import type { TPomegranateAuthPurpose } from '../../electron/shared/ipc-types'
import { renderPomegranateBrowserPage } from './pomegranate-browser-page'

const BrowserAuth = registerPlugin<{
  authenticate(options: {
    requestId: string
    page: string
    csp: string
  }): Promise<{ value: string }>
}>('JumbleBrowserAuth')

/** Only the browser handoff is native; tokens and shards retain their existing validation. */
export async function authenticateInNativeBrowser(
  authUrl: string,
  purpose: TPomegranateAuthPurpose
): Promise<string> {
  const url = new URL(authUrl)
  if (
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
    url.username ||
    url.password ||
    !['/login/google', '/po/recover/google'].includes(url.pathname)
  )
    throw new Error('Invalid Pomegranate authentication URL')

  const random = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
      v.toString(16).padStart(2, '0')
    ).join('')
  const requestId = random()
  const { html, csp } = renderPomegranateBrowserPage({
    authUrl: url.toString(),
    purpose,
    requestId,
    scriptNonce: random(),
    nativeCompletion: true
  })
  const { value } = await BrowserAuth.authenticate({ requestId, page: html, csp })
  return value
}
