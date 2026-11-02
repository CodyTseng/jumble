// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { bridge } = vi.hoisted(() => ({
  bridge: {
    secrets: { isAvailable: vi.fn(), load: vi.fn(), save: vi.fn() },
    localStorage: { load: vi.fn(), save: vi.fn() }
  }
}))
vi.mock('@/lib/native-storage', () => ({ getNativeStorageBridge: () => bridge }))
vi.mock('@/lib/platform', () => ({ isAndroid: () => true }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  localStorage.clear()
  bridge.secrets.isAvailable.mockResolvedValue(true)
  bridge.secrets.load.mockResolvedValue({})
  bridge.secrets.save.mockResolvedValue(undefined)
})

describe('native secure storage', () => {
  it('keeps newly added account secrets out of localStorage and persists them natively', async () => {
    bridge.secrets.load.mockResolvedValue({ nsec: { existing: 'secret-from-keystore' } })
    localStorage.setItem('accounts', JSON.stringify([{ pubkey: 'existing', signerType: 'nsec' }]))
    const { default: storage } = await import('@/services/local-storage.service')
    await storage.hydrate()
    expect(storage.getAccountNsec('existing')).toBe('secret-from-keystore')

    storage.addAccount({ pubkey: 'new', signerType: 'nsec', nsec: 'new-secret' })
    await vi.waitFor(() => expect(bridge.secrets.save).toHaveBeenCalled())
    expect(localStorage.getItem('accounts')).not.toContain('new-secret')
    expect(bridge.secrets.save.mock.lastCall?.[0].nsec).toEqual({
      existing: 'secret-from-keystore',
      new: 'new-secret'
    })
  })

  it('cannot overwrite persisted secrets before hydration completes', async () => {
    let finishLoad!: (bundle: object) => void
    bridge.secrets.load.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLoad = resolve
        })
    )
    const { default: storage } = await import('@/services/local-storage.service')
    const hydration = storage.hydrate()
    await vi.waitFor(() => expect(bridge.secrets.load).toHaveBeenCalled())
    storage.setEncryptionKeyPrivkey('test', 'temporary-key')
    await Promise.resolve()
    expect(bridge.secrets.save).not.toHaveBeenCalled()
    finishLoad({ encryptionKeyPrivkey: { existing: 'persisted-key' } })
    await hydration
    expect(bridge.secrets.save).not.toHaveBeenCalled()
  })

  it('fails closed on decryption failure and does not overwrite the encrypted bundle', async () => {
    bridge.secrets.load.mockRejectedValue(new Error('Authentication failed'))
    const { default: storage } = await import('@/services/local-storage.service')
    await expect(storage.hydrate()).rejects.toThrow('secure storage')
    expect(bridge.secrets.save).not.toHaveBeenCalled()
  })

  it('does not clear local preferences when the native snapshot is corrupt', async () => {
    localStorage.setItem('themeSetting', 'dark')
    bridge.localStorage.load.mockResolvedValue({ version: 1, revision: 10, entries: { bad: 123 } })
    const { restoreNativeLocalStorage } = await import('@/lib/native-local-storage')
    await expect(restoreNativeLocalStorage()).rejects.toThrow('Invalid native storage snapshot')
    expect(localStorage.getItem('themeSetting')).toBe('dark')
  })

  it('restores native state before the storage service reads account metadata', async () => {
    bridge.localStorage.load.mockResolvedValue({
      version: 1,
      revision: 10,
      entries: { accounts: JSON.stringify([{ pubkey: 'restored', signerType: 'nsec' }]) }
    })
    const { restoreNativeLocalStorage } = await import('@/lib/native-local-storage')
    await restoreNativeLocalStorage()
    const { default: storage } = await import('@/services/local-storage.service')
    await storage.hydrate()
    expect(storage.getAccounts().map((account) => account.pubkey)).toEqual(['restored'])
  })
})
