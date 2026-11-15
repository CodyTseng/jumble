// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicKey, nip19 } from 'nostr-tools'
import type { useNostr as UseNostr } from '@/providers/NostrProvider'
import type Storage from '@/services/local-storage.service'
let useNostr: typeof UseNostr
let storage: typeof Storage

const { extension, native, bridge } = vi.hoisted(() => ({
  extension: { getPublicKey: vi.fn() },
  native: { enabled: false },
  bridge: { secrets: { isAvailable: vi.fn(), load: vi.fn(), save: vi.fn() } }
}))
vi.mock('@/lib/native-storage', () => ({
  getNativeStorageBridge: () => (native.enabled ? bridge : undefined)
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (value: string) => value }) }))
vi.mock('@/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ enableDm: false })
}))
vi.mock('@/providers/DeletedEventProvider', () => ({
  useDeletedEvent: () => ({ addDeletedEvent: vi.fn() })
}))
vi.mock('@/components/LoginDialog', () => ({ default: () => null }))
vi.mock('@/components/PasswordInputDialog', () => ({
  default: ({ open, onCancel }: { open: boolean; onCancel: () => void }) =>
    open ? createElement('button', { onClick: onCancel }, 'Cancel password') : null
}))
vi.mock('@/services/dialog.service', () => ({ default: {} }))
vi.mock('@/services/client.service', () => ({
  default: {
    fetchEvents: vi.fn(async () => []),
    fetchRelayList: vi.fn(async () => ({ write: [], read: [], originalRelays: [] })),
    setOwnRelayUrls: vi.fn(),
    initUserIndexFromFollowings: vi.fn()
  }
}))
vi.mock('@/services/indexed-db.service', () => ({
  default: { getReplaceableEvent: vi.fn(async () => undefined) }
}))
vi.mock('@/services/custom-emoji.service', () => ({ default: { init: vi.fn() } }))
vi.mock('@/services/dm.service', () => ({ default: { destroy: vi.fn() } }))
vi.mock('@/services/encryption-key.service', () => ({ default: {} }))
vi.mock('@/services/stuff-stats.service', () => ({
  default: { updateStuffStatsByEvents: vi.fn() }
}))
vi.mock('@/services/new-account-setup', () => ({ setupNewAccount: vi.fn() }))
vi.mock('@/providers/NostrProvider/nip-07.signer', () => ({
  Nip07Signer: class {
    async init() {}
    getPublicKey() {
      return extension.getPublicKey()
    }
  }
}))
vi.mock('@/providers/NostrProvider/bunker.signer', () => ({ BunkerSigner: class {} }))
vi.mock('@/providers/NostrProvider/nostrConnection.signer', () => ({
  NostrConnectionSigner: class {}
}))
vi.mock('@/providers/NostrProvider/nip-55.signer', () => ({ Nip55Signer: class {} }))

const privkey = new Uint8Array(32).fill(1)
const pubkey = getPublicKey(privkey)
const saved = { pubkey, signerType: 'nsec' as const, nsec: nip19.nsecEncode(privkey) }
let context: ReturnType<typeof useNostr>
let root: Root
let container: HTMLDivElement
function Consumer() {
  context = useNostr()
  return null
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  vi.resetModules()
  bridge.secrets.isAvailable.mockResolvedValue(true)
  bridge.secrets.load.mockResolvedValue({})
  bridge.secrets.save.mockResolvedValue(undefined)
  extension.getPublicKey.mockResolvedValue(pubkey)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function mount() {
  storage = (await import('@/services/local-storage.service')).default
  const provider = await import('@/providers/NostrProvider')
  useNostr = provider.useNostr
  await storage.hydrate()
  if (native.enabled) expect(bridge.secrets.load).toHaveBeenCalled()
  storage.addAccount(saved)
  storage.switchAccount(saved)
  await act(async () =>
    root.render(createElement(provider.NostrProvider, null, createElement(Consumer)))
  )
  expect(context.account).toEqual({ pubkey, signerType: 'nsec' })
  if (native.enabled) expect(localStorage.getItem('accounts')).not.toContain(saved.nsec)
}

describe.each([false, true])('login replacement (native storage: %s)', (enabled) => {
  beforeEach(() => {
    native.enabled = enabled
  })

  it('keeps the existing session while authentication is pending, then replaces it on success', async () => {
    await mount()
    const previousSigner = context.signer
    let finish!: (key: string) => void
    extension.getPublicKey.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    let pending!: Promise<string>
    await act(async () => {
      pending = context.nip07Login()
    })
    expect(context.signer).toBe(previousSigner)
    expect(storage.getCurrentAccount()).toMatchObject(saved)
    await act(async () => {
      finish(pubkey)
      await pending
    })
    expect(context.accounts).toEqual([expect.objectContaining({ pubkey, signerType: 'nip-07' })])
    expect(context.account).toEqual({ pubkey, signerType: 'nip-07' })
    expect(context.signer).not.toBe(previousSigner)
    expect(storage.getAccountNsec(pubkey)).toBeUndefined()
  })

  it('preserves the active signer and persisted credentials after a rejected replacement', async () => {
    await mount()
    const previousSigner = context.signer
    const before = localStorage.getItem('accounts')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const savedWrites = bridge.secrets.save.mock.calls.length
    extension.getPublicKey.mockRejectedValueOnce(new Error('User denied'))
    await act(async () => {
      await expect(context.nip07Login()).rejects.toThrow('User denied')
    })
    expect(context.signer).toBe(previousSigner)
    expect(storage.getCurrentAccount()).toMatchObject(saved)
    expect(localStorage.getItem('accounts')).toBe(before)
    expect(bridge.secrets.save).toHaveBeenCalledTimes(savedWrites)
    await expect(previousSigner!.getPublicKey()).resolves.toBe(pubkey)
  })

  it('preserves the original login after a password dialog is cancelled', async () => {
    await mount()
    const previousSigner = context.signer
    let result!: Promise<string>
    await act(async () => {
      result = context.ncryptsecLogin('encrypted-key')
    })
    const rejected = expect(result).rejects.toBeUndefined()
    await act(async () => {
      container.querySelector('button')!.click()
      await rejected
    })
    expect(context.signer).toBe(previousSigner)
    expect(storage.getCurrentAccount()).toMatchObject(saved)
  })

  it('a new lower-priority login also replaces the previous method', async () => {
    await mount()
    await act(async () => {
      await context.nip07Login()
    })
    await act(async () => {
      await context.nsecLogin(saved.nsec)
    })
    expect(context.accounts).toHaveLength(1)
    expect(context.account).toEqual({ pubkey, signerType: 'nsec' })
    expect(storage.getCurrentAccount()).toMatchObject(saved)
    await expect(context.signer!.getPublicKey()).resolves.toBe(pubkey)
  })

  it('rejects a signer identity mismatch before changing the saved method', async () => {
    await mount()
    const previousSigner = context.signer
    extension.getPublicKey.mockResolvedValueOnce(pubkey).mockResolvedValueOnce('different-pubkey')
    await act(async () => {
      await expect(context.nip07Login()).rejects.toThrow('Signer public key does not match')
    })
    expect(context.signer).toBe(previousSigner)
    expect(storage.getCurrentAccount()).toMatchObject(saved)
    expect(storage.getAccounts()).toHaveLength(1)
  })
})
