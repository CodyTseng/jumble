// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ android: true }))
const client = vi.hoisted(() => ({ fetchDmRelays: vi.fn(async () => []) }))
vi.mock('@/lib/platform', () => ({ isAndroid: () => platform.android }))
vi.mock('@/lib/native-storage', () => ({ getNativeStorageBridge: () => undefined }))
vi.mock('@/services/client.service', () => ({ default: client }))
vi.mock('@/services/indexed-db.service', () => ({ default: {} }))
vi.mock('@/services/crypto-file.service', () => ({ default: {} }))
vi.mock('@/services/encryption-key.service', () => ({ default: {} }))
vi.mock('@/services/nip17-gift-wrap.service', () => ({ default: {} }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  platform.android = true
  localStorage.clear()
})

describe('Android DM restriction', () => {
  it.each([null, 'true', 'false'])('stays off with saved preference %s', async (saved) => {
    if (saved !== null) localStorage.setItem('enableDm', saved)
    const { default: storage } = await import('@/services/local-storage.service')
    expect(storage.getEnableDm()).toBe(false)
    storage.setEnableDm(true)
    expect(storage.getEnableDm()).toBe(false)
    expect(localStorage.getItem('enableDm')).toBe('false')
  })

  it('blocks DM initialization and message sync before network or key access', async () => {
    const { default: dmService } = await import('@/services/dm.service')
    const key = { pubkey: 'test-encryption-pubkey', privkey: new Uint8Array(32) }
    await expect(dmService.init('test-account', key)).resolves.toBeUndefined()
    await expect(dmService.initMessages('test-account', key)).resolves.toBeUndefined()
    expect(client.fetchDmRelays).not.toHaveBeenCalled()
  })

  it('preserves the default and toggle behavior on other platforms', async () => {
    platform.android = false
    const { default: storage } = await import('@/services/local-storage.service')
    expect(storage.getEnableDm()).toBe(true)
    storage.setEnableDm(false)
    expect(storage.getEnableDm()).toBe(false)
    storage.setEnableDm(true)
    expect(storage.getEnableDm()).toBe(true)
    expect(localStorage.getItem('enableDm')).toBe('true')
  })
})
