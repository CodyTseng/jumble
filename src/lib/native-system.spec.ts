// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, openExternalUrl } from './native-system'
const harness = vi.hoisted(() => ({
  android: true,
  writeClipboard: vi.fn(),
  openUrl: vi.fn(),
  error: vi.fn()
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => harness }))
vi.mock('./platform', () => ({ isAndroid: () => harness.android }))
vi.mock('sonner', () => ({ toast: { error: harness.error } }))
vi.mock('i18next', () => ({ t: (key: string) => key }))
beforeEach(() => {
  vi.clearAllMocks()
  harness.android = true
  harness.openUrl.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('native system adapters', () => {
  it('copies through Android rather than the WebView clipboard', async () => {
    await copyText('public-key-test')
    expect(harness.writeClipboard).toHaveBeenCalledWith({ text: 'public-key-test' })
  })
  it('uses the web clipboard outside Android', async () => {
    harness.android = false
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyText('public-key-test')
    expect(writeText).toHaveBeenCalledWith('public-key-test')
    expect(harness.writeClipboard).not.toHaveBeenCalled()
  })
  it('does not send executable or embedded-data URLs to the native launcher', () => {
    openExternalUrl('javascript:alert(1)')
    openExternalUrl('data:text/html,test')
    expect(harness.openUrl).not.toHaveBeenCalled()
  })
  it('shows an error when an external app cannot be opened', async () => {
    harness.openUrl.mockRejectedValue(new Error('No app available'))
    openExternalUrl('https://example.com/')
    await vi.waitFor(() => expect(harness.error).toHaveBeenCalled())
  })
})
