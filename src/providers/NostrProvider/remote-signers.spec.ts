import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Nip46Pool } from '@/lib/nip46-pool'

const mocks = vi.hoisted(() => ({
  release: vi.fn(),
  fromBunker: vi.fn(),
  fromURI: vi.fn()
}))
vi.mock('@/services/client.service', () => ({
  default: {
    acquireSignerRelayUrls: vi.fn(() => mocks.release),
    relayPool: { ensureRelay: async () => ({ subscribe: () => ({ close: vi.fn() }) }) }
  }
}))
vi.mock('@/lib/native-system', () => ({ openExternalUrl: vi.fn() }))
vi.mock('nostr-tools/nip46', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nostr-tools/nip46')>()),
  BunkerSigner: { fromBunker: mocks.fromBunker, fromURI: mocks.fromURI }
}))
import client from '@/services/client.service'
import { BunkerSigner } from './bunker.signer'
import { NostrConnectionSigner } from './nostrConnection.signer'

const pubkey = 'a'.repeat(64)
const relay = 'wss://localhost:7447/'
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('remote signer failure cleanup', () => {
  it('restores the saved user key when the bunker URL identifies a different remote signer', async () => {
    const userPubkey = 'b'.repeat(64)
    const remote = { getPublicKey: vi.fn(), connect: vi.fn(), close: vi.fn() }
    mocks.fromBunker.mockReturnValue(remote)
    const signer = new BunkerSigner()
    expect(
      await signer.restore(`bunker://${pubkey}?relay=${encodeURIComponent(relay)}`, userPubkey)
    ).toBe(userPubkey)
    expect(mocks.fromBunker.mock.lastCall?.[1].pubkey).toBe(pubkey)
    await expect(signer.getPublicKey()).resolves.toBe(userPubkey)
    expect(remote.getPublicKey).not.toHaveBeenCalled()
    expect(remote.connect).not.toHaveBeenCalled()
    await signer.close()
  })

  it('queries and caches the user key on a new bunker connection', async () => {
    vi.useFakeTimers()
    const userPubkey = 'b'.repeat(64)
    const remote = {
      getPublicKey: vi.fn(async () => userPubkey),
      connect: vi.fn(async () => undefined),
      close: vi.fn()
    }
    mocks.fromBunker.mockReturnValue(remote)
    const signer = new BunkerSigner()
    await expect(
      signer.login(`bunker://${pubkey}?relay=${encodeURIComponent(relay)}`)
    ).resolves.toBe(userPubkey)
    await expect(signer.getPublicKey()).resolves.toBe(userPubkey)
    expect(remote.getPublicKey).toHaveBeenCalledOnce()
    expect(remote.connect).toHaveBeenCalledOnce()
    await signer.close()
  })

  it('never uses the remote URL key as the user key without a saved identity', async () => {
    vi.useFakeTimers()
    const userPubkey = 'b'.repeat(64)
    const remote = { getPublicKey: vi.fn(async () => userPubkey), close: vi.fn() }
    mocks.fromBunker.mockReturnValue(remote)
    const signer = new BunkerSigner()
    await expect(
      signer.login(`bunker://${pubkey}?relay=${encodeURIComponent(relay)}`, false)
    ).resolves.toBe(userPubkey)
    expect(remote.getPublicKey).toHaveBeenCalledOnce()
    await signer.close()
  })

  it('releases an explicitly configured local bunker relay when connection fails', async () => {
    vi.useFakeTimers()
    mocks.fromBunker.mockImplementation((_key, pointer, { pool }: { pool: Nip46Pool }) => {
      const sub = pool.subscribe(pointer.relays, { kinds: [24133] }, {})
      return {
        connect: async () => {
          throw new Error('Connection failed')
        },
        close: async () => sub.close()
      }
    })
    const signer = new BunkerSigner()
    await expect(
      signer.login(`bunker://${pubkey}?relay=${encodeURIComponent(relay)}`)
    ).rejects.toThrow('Connection failed')
    expect(client.acquireSignerRelayUrls).toHaveBeenCalledWith([relay])
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(signer.signer).toBeNull()
  })

  it('releases the pairing subscription when nostrconnect login fails', async () => {
    mocks.fromURI.mockImplementation(async (_key, _uri, { pool }: { pool: Nip46Pool }) => {
      pool.subscribe([relay], { kinds: [24133] }, {})
      throw new Error('Pairing failed')
    })
    const signer = new NostrConnectionSigner(
      new Uint8Array(32),
      `nostrconnect://${pubkey}?relay=${encodeURIComponent(relay)}&secret=test`
    )
    await expect(signer.login()).rejects.toThrow('Pairing failed')
    expect(client.acquireSignerRelayUrls).toHaveBeenCalledWith([relay])
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(signer.signer).toBeNull()
  })
})
