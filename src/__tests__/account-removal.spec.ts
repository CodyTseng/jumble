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
const methods: TAccount[] = [
  { pubkey, signerType: 'nip-07' },
  { pubkey, signerType: 'bunker', bunker: 'bunker://test', bunkerClientSecretKey: 'bunker-secret' },
  { pubkey, signerType: 'ncryptsec', ncryptsec: 'encrypted-secret' },
  { pubkey, signerType: 'nsec', nsec: 'local-secret' },
  { pubkey, signerType: 'browser-nsec', nsec: 'local-secret' },
  { pubkey, signerType: 'nip-55', signerPackageName: 'com.example.signer' },
  { pubkey, signerType: 'npub', npub: 'npub-test' }
]
const other: TAccount = { pubkey: 'other', signerType: 'nsec', nsec: 'other-secret' }

async function loadStorage() {
  const { default: storage } = await import('@/services/local-storage.service')
  await storage.hydrate()
  return storage
}

async function reloadStorage() {
  if (native.enabled) {
    // Flush the service's serialized native writes before simulating another process.
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (bridge.secrets.save.mock.calls.length) {
      bridge.secrets.load.mockResolvedValue(bridge.secrets.save.mock.lastCall?.[0])
    }
  }
  vi.resetModules()
  return loadStorage()
}

function seed(accounts: TAccount[], current = accounts[0]) {
  localStorage.setItem('accounts', JSON.stringify(accounts))
  localStorage.setItem('currentAccount', JSON.stringify(current))
  if (native.enabled) {
    bridge.secrets.load.mockResolvedValue({
      nsec: { [pubkey]: 'local-secret', other: 'other-secret' },
      ncryptsec: { [pubkey]: 'encrypted-secret' },
      bunkerClientSecretKey: { [pubkey]: 'bunker-secret' }
    })
  }
}

function expectOnlyCredential(storage: Awaited<ReturnType<typeof loadStorage>>, account: TAccount) {
  expect(storage.getAccountNsec(pubkey)).toBe(
    account.signerType === 'nsec' ? account.nsec : undefined
  )
  expect(storage.getAccountNcryptsec(pubkey)).toBe(
    account.signerType === 'ncryptsec' ? account.ncryptsec : undefined
  )
  expect(storage.getBunkerClientSecretKey(pubkey)).toBe(
    account.signerType === 'bunker' ? account.bunkerClientSecretKey : undefined
  )
}

describe.each([false, true])('one login per pubkey (native storage: %s)', (enabled) => {
  beforeEach(() => {
    native.enabled = enabled
  })

  it.each(
    methods.slice(0, 4).flatMap((winner) => [true, false].map((reverse) => ({ winner, reverse })))
  )(
    'migrates duplicates using priority from $winner.signerType down (reverse: $reverse)',
    async ({ winner, reverse }) => {
      const candidates = methods.slice(methods.indexOf(winner))
      seed((reverse ? [...candidates].reverse() : candidates).concat(other), candidates.at(-1))
      const storage = await loadStorage()
      expect(storage.getAccounts()).toHaveLength(2)
      expect(storage.findAccount(winner)).toMatchObject(winner)
      expect(storage.getCurrentAccount()).toMatchObject(winner)
      expectOnlyCredential(storage, winner)
      expect(storage.findAccount(other)).toMatchObject(other)
      const persisted = localStorage.getItem('accounts')
      const reloaded = await reloadStorage()
      await reloaded.hydrate()
      expect(reloaded.getAccounts()).toEqual(storage.getAccounts())
      expect(reloaded.getCurrentAccount()).toMatchObject(winner)
      expect(localStorage.getItem('accounts')).toBe(persisted)
      expectOnlyCredential(reloaded, winner)
      if (enabled)
        expect(persisted).not.toMatch(/local-secret|encrypted-secret|bunker-secret|other-secret/)
    }
  )

  it.each(methods)('retains a sole $signerType and normalizes browser-nsec', async (account) => {
    seed([account])
    const storage = await loadStorage()
    const normalized =
      account.signerType === 'browser-nsec' ? { ...account, signerType: 'nsec' } : account
    expect(storage.getAccounts()).toHaveLength(1)
    expect(storage.getCurrentAccount()).toMatchObject(normalized)
  })

  it('skips incomplete high-priority credentials when a usable lower-priority method exists', async () => {
    seed([{ pubkey, signerType: 'bunker' }, methods[3]])
    const storage = await loadStorage()
    // Native tests normally seed a client key; the missing bunker URL still makes this incomplete.
    expect(storage.getCurrentAccount()).toMatchObject(methods[3])
    expectOnlyCredential(storage, methods[3])
  })

  it.each(methods.filter((method) => method.signerType !== 'browser-nsec'))(
    'replaces an existing method with successful $signerType and persists only its credentials',
    async (next) => {
      const storage = await loadStorage()
      storage.addAccount(methods[3])
      storage.switchAccount(methods[3])
      storage.addAccount(other)
      storage.addAccount(next)
      storage.switchAccount(next)
      expect(storage.getAccounts()).toHaveLength(2)
      expect(storage.getCurrentAccount()).toMatchObject(next)
      expectOnlyCredential(storage, next)
      storage.addAccount(next)
      expect(storage.getAccounts()).toHaveLength(2)
      const reloaded = await reloadStorage()
      expect(reloaded.getCurrentAccount()).toMatchObject(next)
      expectOnlyCredential(reloaded, next)
      expect(reloaded.findAccount(other)).toMatchObject(other)
    }
  )

  it('prefers a saved Android signing method to a read-only npub without losing package metadata', async () => {
    seed([methods[6], methods[5]], methods[6])
    const storage = await loadStorage()
    expect(storage.getAccounts()).toHaveLength(1)
    expect(storage.getCurrentAccount()).toMatchObject(methods[5])
  })

  it('keeps credentials on an incomplete sole legacy record rather than discarding unknown access', async () => {
    seed([{ pubkey, signerType: 'nip-55', nsec: 'local-secret' }])
    const storage = await loadStorage()
    expect(storage.getAccounts()).toHaveLength(1)
    expect(storage.getAccountNsec(pubkey)).toBe('local-secret')
    const reloaded = await reloadStorage()
    expect(reloaded.getAccountNsec(pubkey)).toBe('local-secret')
  })

  it('ignores removal of a stale login pointer and cleans credentials when the saved method is removed', async () => {
    const storage = await loadStorage()
    storage.addAccount(methods[3])
    storage.addAccount(methods[2])
    storage.switchAccount(methods[2])
    storage.addAccount(other)
    storage.removeAccount(methods[3])
    expect(storage.getCurrentAccount()).toMatchObject(methods[2])
    storage.removeAccount(methods[2])
    expect(storage.getCurrentAccount()).toBeNull()
    const reloaded = await reloadStorage()
    expect(reloaded.getAccounts()).toEqual([expect.objectContaining(other)])
    expect(reloaded.getAccountNsec(pubkey)).toBeUndefined()
    expect(reloaded.getAccountNcryptsec(pubkey)).toBeUndefined()
    expect(reloaded.getBunkerClientSecretKey(pubkey)).toBeUndefined()
  })
})

it('defers native migration when the secure store cannot be loaded', async () => {
  native.enabled = true
  seed(methods.slice(1, 4))
  const before = localStorage.getItem('accounts')
  bridge.secrets.load.mockRejectedValue(new Error('locked'))
  const { default: storage } = await import('@/services/local-storage.service')
  await storage.hydrate()
  expect(storage.getAccounts()).toHaveLength(3)
  expect(bridge.secrets.save).not.toHaveBeenCalled()
  // Metadata is scrubbed of plaintext, but no login method has been discarded.
  expect(JSON.parse(localStorage.getItem('accounts')!)).toHaveLength(JSON.parse(before!).length)
})
