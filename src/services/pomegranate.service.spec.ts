import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import pomegranateService, { PomegranatePopupClosedError } from './pomegranate.service'

const native = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock('@/constants', () => ({ POMEGRANATE_OPERATOR_URLS: [] }))
vi.mock('@/lib/platform', () => ({ getElectronBridge: () => undefined, isAndroid: () => true }))
vi.mock('@/lib/native-browser-auth', () => ({ authenticateInNativeBrowser: native.authenticate }))

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

it('continues the shared account lookup after Android browser authorization', async () => {
  const token = btoa(
    JSON.stringify({
      created_at: Math.floor(Date.now() / 1000),
      tags: [['email', 'test@example.com']]
    })
  )
  native.authenticate.mockResolvedValue(token)
  const fetch = vi.fn(async () => new Response(null, { status: 404 }))
  vi.stubGlobal('fetch', fetch)
  const result = await pomegranateService.startLogin('https://auth.example/', vi.fn())
  expect(result).toMatchObject({
    token: { raw: token, email: 'test@example.com' },
    hasAccount: false
  })
  expect(native.authenticate).toHaveBeenCalledWith('https://auth.example/login/google', 'login')
  expect(fetch).toHaveBeenCalledWith(
    'https://auth.example/account',
    expect.objectContaining({ headers: { Authorization: `Token ${token}` } })
  )
})

it('keeps the existing shard validation after Android operator authorization', async () => {
  native.authenticate.mockResolvedValue('different-shard')
  await expect(
    pomegranateService.recoverShard({
      url: 'https://operator.example',
      pubshard: 'expected-prefix'
    })
  ).rejects.toThrow('Recovered shard does not match the operator')
  expect(native.authenticate).toHaveBeenCalledWith(
    'https://operator.example/po/recover/google',
    'recovery'
  )
})

it('maps browser cancellation to the existing dismissed-login behavior', async () => {
  native.authenticate.mockRejectedValue(
    Object.assign(new Error('cancelled'), { code: 'CANCELLED' })
  )
  await expect(
    pomegranateService.startLogin('https://auth.example', vi.fn())
  ).rejects.toBeInstanceOf(PomegranatePopupClosedError)
})

it('keeps browser recovery cancellation quiet', async () => {
  native.authenticate.mockRejectedValue(
    Object.assign(new Error('cancelled'), { code: 'CANCELLED' })
  )
  await expect(
    pomegranateService.recoverShard({ url: 'https://operator.example', pubshard: 'prefix' })
  ).rejects.toBeInstanceOf(PomegranatePopupClosedError)
})
