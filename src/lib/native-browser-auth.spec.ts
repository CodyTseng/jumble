import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateInNativeBrowser } from './native-browser-auth'

const native = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => native }))

beforeEach(() => {
  vi.clearAllMocks()
  native.authenticate.mockResolvedValue({ value: 'test-token' })
})

describe('Android browser authorization', () => {
  it('uses the shared relay page and returns the native result', async () => {
    expect(await authenticateInNativeBrowser('https://auth.example/login/google', 'login')).toBe(
      'test-token'
    )
    const options = native.authenticate.mock.calls[0][0]
    expect(options.requestId).toMatch(/^[a-f0-9]{64}$/)
    expect(options.page).toContain('https://auth.example/login/google')
    expect(options.page).toContain('const nativeCompletion = true')
    expect(options.page).not.toContain('Return to Jumble')
    expect(options.page).toContain('event.source !== popup || event.origin !== expectedOrigin')
    expect(options.csp).toContain("connect-src 'self'")
    expect(options.csp).not.toContain("script-src 'unsafe-inline'")
  })

  it('uses a fresh session for operator recovery and propagates cancellation', async () => {
    await authenticateInNativeBrowser('https://operator.example/po/recover/google', 'recovery')
    const first = native.authenticate.mock.calls[0][0].requestId
    native.authenticate.mockRejectedValueOnce(
      Object.assign(new Error('cancelled'), { code: 'CANCELLED' })
    )
    await expect(
      authenticateInNativeBrowser('https://auth.example/login/google', 'bind')
    ).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(native.authenticate.mock.calls[1][0].requestId).not.toBe(first)
  })

  it.each([
    'javascript:alert(1)',
    'https://user:pass@example.com/login/google',
    'http://remote.example/login/google',
    'https://auth.example/unrelated'
  ])('rejects unsafe authorization URL %s', async (url) => {
    await expect(authenticateInNativeBrowser(url, 'login')).rejects.toThrow()
    expect(native.authenticate).not.toHaveBeenCalled()
  })
})
