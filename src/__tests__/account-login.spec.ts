// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublicKey, nip19 } from 'nostr-tools'
import type { TAccount } from '@/types'
import type { useNostr as UseNostr } from '@/providers/NostrProvider'
import type Storage from '@/services/local-storage.service'
let useNostr: typeof UseNostr
let storage: typeof Storage

const { extension, native, bridge, remote } = vi.hoisted(() => ({
  extension: { getPublicKey: vi.fn() },
  remote: { fromBunker: vi.fn(), getPublicKey: vi.fn(), connect: vi.fn(), close: vi.fn() },
  native: { enabled: false },
  bridge: { secrets: { isAvailable: vi.fn(), load: vi.fn(), save: vi.fn() } }
}))
vi.mock('@/lib/native-storage', () => ({
  getNativeStorageBridge: () => (native.enabled ? bridge : undefined)
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (value: string) => value }) }))
vi.mock('@/lib/signer-approval', () => ({
  withSignerApproval: <T>(promise: Promise<T>) => promise
}))
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
vi.mock('nostr-tools/nip46', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nostr-tools/nip46')>()),
  BunkerSigner: { fromBunker: remote.fromBunker }
}))
vi.mock('@/lib/native-system', () => ({ openExternalUrl: vi.fn() }))
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
  extension.getPublicKey.mockReset().mockResolvedValue(pubkey)
  remote.fromBunker.mockReturnValue(remote)
  remote.getPublicKey.mockResolvedValue(pubkey)
  remote.close.mockResolvedValue(undefined)
  vi.stubGlobal('nostr', { getPublicKey: extension.getPublicKey, signEvent: vi.fn() })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(initial: TAccount = saved) {
  storage = (await import('@/services/local-storage.service')).default
  const provider = await import('@/providers/NostrProvider')
  useNostr = provider.useNostr
  await storage.hydrate()
  if (native.enabled) expect(bridge.secrets.load).toHaveBeenCalled()
  storage.addAccount(initial)
  storage.switchAccount(initial)
  await act(async () =>
    root.render(createElement(provider.NostrProvider, null, createElement(Consumer)))
  )
  if (initial === saved) expect(context.account).toEqual({ pubkey, signerType: 'nsec' })
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

  it('uses the real NIP-07 public-key cache and asks the extension only once', async () => {
    await mount()
    await act(async () => {
      await context.nip07Login()
    })
    await expect(context.signer!.getPublicKey()).resolves.toBe(pubkey)
    expect(extension.getPublicKey).toHaveBeenCalledTimes(1)
  })

  it('restores a real bunker signer with separate remote and user public keys without a network query', async () => {
    const initial: TAccount = {
      pubkey,
      signerType: 'bunker',
      bunker: `bunker://${'a'.repeat(64)}?relay=wss%3A%2F%2Frelay.example`,
      bunkerClientSecretKey: '01'.repeat(32)
    }
    await mount(initial)
    expect(context.isInitialized).toBe(true)
    expect(context.account).toEqual({ pubkey, signerType: 'bunker' })
    await expect(context.signer!.getPublicKey()).resolves.toBe(pubkey)
    expect(remote.getPublicKey).not.toHaveBeenCalled()
    expect(remote.connect).not.toHaveBeenCalled()
    expect(remote.fromBunker.mock.lastCall?.[1].pubkey).toBe('a'.repeat(64))
    expect(storage.getCurrentAccount()).toMatchObject(initial)
  })

  it('finishes initialization immediately on logout while a restore is still pending', async () => {
    let finish!: (key: string) => void
    extension.getPublicKey.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    const initial: TAccount = { pubkey, signerType: 'nip-07' }
    await mount(initial)
    expect(context.isInitialized).toBe(false)
    await act(async () => {
      await context.switchAccount(null)
    })
    expect(context.isInitialized).toBe(true)
    await act(async () => {
      finish(pubkey)
      await Promise.resolve()
    })
    expect(context.account).toBeNull()
    expect(storage.getCurrentAccount()).toBeNull()
    expect(storage.findAccount(initial)).toMatchObject(initial)
  })

  it.each(['reject', 'changed'] as const)(
    'finishes initialization after a %s NIP-07 restore and preserves the saved login',
    async (failure) => {
      if (failure === 'reject')
        extension.getPublicKey.mockRejectedValueOnce(new Error('User denied'))
      else extension.getPublicKey.mockResolvedValueOnce('different-pubkey')
      const initial: TAccount = { pubkey, signerType: 'nip-07' }
      await mount(initial)
      expect(context.isInitialized).toBe(true)
      expect(context.account).toBeNull()
      expect(storage.getCurrentAccount()).toMatchObject(initial)
      expect(storage.findAccount(initial)).toMatchObject(initial)
      extension.getPublicKey.mockResolvedValue(pubkey)
      await act(async () => {
        await context.switchAccount(initial)
      })
      expect(context.account).toEqual(initial)
    }
  )

  it('finishes initialization if the NIP-07 extension is absent', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('nostr', undefined)
    const initial: TAccount = { pubkey, signerType: 'nip-07' }
    await mount(initial)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_001)
    })
    expect(context.isInitialized).toBe(true)
    expect(context.account).toBeNull()
    expect(storage.findAccount(initial)).toMatchObject(initial)
  })

  it('closes a late bunker candidate after logout without overwriting existing credentials', async () => {
    await mount()
    vi.useFakeTimers()
    let finish!: (key: string) => void
    remote.getPublicKey.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    let pending!: Promise<string>
    await act(async () => {
      pending = context.bunkerLogin(`bunker://${'a'.repeat(64)}?relay=wss%3A%2F%2Frelay.example`)
    })
    const rejected = expect(pending).rejects.toThrow('Login cancelled')
    await act(async () => {
      await context.switchAccount(null)
    })
    await act(async () => {
      finish(pubkey)
      await rejected
    })
    expect(context.account).toBeNull()
    expect(storage.getCurrentAccount()).toBeNull()
    expect(storage.findAccount(saved)).toMatchObject(saved)
    expect(remote.close).toHaveBeenCalledOnce()
  })

  it('bounds a hanging NIP-07 restore and ignores the late approval', async () => {
    vi.useFakeTimers()
    let finish!: (key: string) => void
    extension.getPublicKey.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    const initial: TAccount = { pubkey, signerType: 'nip-07' }
    await mount(initial)
    expect(context.isInitialized).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_001)
    })
    expect(context.isInitialized).toBe(true)
    expect(context.account).toBeNull()
    expect(storage.getCurrentAccount()).toMatchObject(initial)
    await act(async () => {
      finish(pubkey)
      await Promise.resolve()
    })
    expect(context.account).toBeNull()
  })

  it.each(['logout', 'switch', 'remove'] as const)(
    'does not commit a pending login after %s',
    async (action) => {
      await mount()
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
      const rejected = expect(pending).rejects.toThrow('Login cancelled')
      const another = {
        pubkey: getPublicKey(new Uint8Array(32).fill(2)),
        signerType: 'nsec' as const,
        nsec: nip19.nsecEncode(new Uint8Array(32).fill(2))
      }
      await act(async () => {
        if (action === 'logout') await context.switchAccount(null)
        else if (action === 'remove') context.removeAccount(saved)
        else {
          storage.addAccount(another)
          await context.switchAccount(another)
        }
      })
      await act(async () => {
        finish(pubkey)
        await rejected
      })
      expect(context.account).toEqual(
        action === 'switch' ? { pubkey: another.pubkey, signerType: 'nsec' } : null
      )
      expect(storage.getCurrentAccount()?.pubkey ?? null).toBe(
        action === 'switch' ? another.pubkey : null
      )
      expect(storage.findAccount({ pubkey, signerType: 'nip-07' })).toBeUndefined()
      if (action !== 'remove') expect(storage.findAccount(saved)).toMatchObject(saved)
    }
  )
})
