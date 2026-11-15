// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TAccount } from '@/types'

const { native, bridge } = vi.hoisted(() => ({
  native: { enabled: false },
  bridge: { secrets: { isAvailable: vi.fn(), load: vi.fn(), save: vi.fn() } }
}))
vi.mock('@/lib/native-storage', () => ({
  getNativeStorageBridge: () => (native.enabled ? bridge : undefined)
}))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  localStorage.clear()
  bridge.secrets.isAvailable.mockResolvedValue(true)
  bridge.secrets.load.mockResolvedValue({})
  bridge.secrets.save.mockResolvedValue(undefined)
})

const pubkey = 'test-pubkey'
const accounts: TAccount[] = [
  { pubkey, signerType: 'nsec', nsec: 'test-nsec' },
  { pubkey, signerType: 'ncryptsec', ncryptsec: 'test-ncryptsec' },
  { pubkey, signerType: 'bunker', bunkerClientSecretKey: 'test-bunker-secret' }
]
const readOnly: TAccount = { pubkey, signerType: 'npub' }

async function loadStorage() {
  const { default: storage } = await import('@/services/local-storage.service')
  await storage.hydrate()
  return storage
}

async function reloadStorage() {
  if (native.enabled) {
    await vi.waitFor(() => expect(bridge.secrets.save).toHaveBeenCalled())
    // Wait for every queued snapshot before simulating a fresh native launch.
    await new Promise((resolve) => setTimeout(resolve, 0))
    bridge.secrets.load.mockResolvedValue(bridge.secrets.save.mock.lastCall?.[0])
  }
  vi.resetModules()
  return loadStorage()
}

describe.each([false, true])('account removal (native storage: %s)', (nativeEnabled) => {
  beforeEach(() => {
    native.enabled = nativeEnabled
  })

  it('preserves every other login method and the current account after removing a read-only entry', async () => {
    const storage = await loadStorage()
    accounts.forEach((account) => storage.addAccount(account))
    storage.addAccount(readOnly)
    storage.switchAccount(accounts[0])

    expect(storage.removeAccount(readOnly)).toHaveLength(accounts.length)
    for (const account of accounts) {
      expect(storage.findAccount(account)).toMatchObject(account)
    }
    expect(storage.getCurrentAccount()).toMatchObject(accounts[0])

    const reloaded = await reloadStorage()
    for (const account of accounts) {
      expect(reloaded.findAccount(account)).toMatchObject(account)
    }
    expect(reloaded.getCurrentAccount()).toMatchObject(accounts[0])
  })

  it.each(accounts)('cleans only unused credentials when removing $signerType', async (removed) => {
    const storage = await loadStorage()
    accounts.forEach((account) => storage.addAccount(account))
    storage.addAccount(readOnly)
    storage.switchAccount(removed)
    storage.addAccount({ pubkey: 'other-pubkey', signerType: 'nsec', nsec: 'other-secret' })

    storage.removeAccount(removed)
    expect(storage.getCurrentAccount()).toBeNull()
    const reloaded = await reloadStorage()
    expect(reloaded.findAccount(removed)).toBeUndefined()
    expect(reloaded.getCurrentAccount()).toBeNull()
    for (const account of accounts.filter((account) => account !== removed)) {
      expect(reloaded.findAccount(account)).toMatchObject(account)
      reloaded.switchAccount(account)
      expect(reloaded.getCurrentAccount()).toMatchObject(account)
    }
    const secretField =
      removed.signerType === 'nsec'
        ? 'nsec'
        : removed.signerType === 'ncryptsec'
          ? 'ncryptsec'
          : 'bunkerClientSecretKey'
    expect(reloaded.findAccount(readOnly)?.[secretField]).toBeUndefined()
    expect(reloaded.getAccountNsec('other-pubkey')).toBe('other-secret')
  })

  it.each(accounts)(
    'preserves the active login when removing inactive $signerType',
    async (removed) => {
      const initial = await loadStorage()
      accounts.forEach((account) => initial.addAccount(account))
      const active = accounts.find((account) => account !== removed)!
      initial.switchAccount(active)
      const storage = await reloadStorage()

      storage.removeAccount(removed)
      expect(storage.getCurrentAccount()).toMatchObject(active)
      const reloaded = await reloadStorage()
      expect(reloaded.getCurrentAccount()).toMatchObject(active)
      expect(reloaded.findAccount(removed)).toBeUndefined()
      const removedSecret =
        removed.signerType === 'nsec'
          ? reloaded.getAccountNsec(pubkey)
          : removed.signerType === 'ncryptsec'
            ? reloaded.getAccountNcryptsec(pubkey)
            : reloaded.getBunkerClientSecretKey(pubkey)
      expect(removedSecret).toBeUndefined()
    }
  )

  it.each(['nsec', 'browser-nsec'] as const)(
    'keeps the shared nsec until the last legacy/current entry is removed (%s first)',
    async (first) => {
      const storage = await loadStorage()
      const legacy: TAccount = { ...accounts[0], signerType: 'browser-nsec' }
      storage.addAccount(accounts[0])
      storage.addAccount(legacy)
      const removed = first === 'nsec' ? accounts[0] : legacy
      const remaining = first === 'nsec' ? legacy : accounts[0]
      storage.removeAccount(removed)
      const reloaded = await reloadStorage()
      expect(reloaded.findAccount(remaining)?.nsec).toBe('test-nsec')
      reloaded.removeAccount(remaining)
      expect(reloaded.getAccounts()).toEqual([])
      expect(reloaded.getAccountNsec(pubkey)).toBeUndefined()
    }
  )
})
