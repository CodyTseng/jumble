import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Event, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import { BIG_RELAY_URLS, JUMBLE_BLOSSOM_SERVER } from '@/constants'
import { TDraftEvent } from '@/types'
import client from './client.service'
import indexedDb from './indexed-db.service'
import { setupNewAccount } from './new-account-setup'

vi.mock('./client.service', () => ({
  default: {
    publishEvent: vi.fn(),
    updateFollowListCache: vi.fn(),
    updateRelayListCache: vi.fn(),
    updateBlossomServerListEventCache: vi.fn()
  }
}))
vi.mock('./indexed-db.service', () => ({
  default: {
    getReplaceableEvent: vi.fn(),
    putReplaceableEvent: vi.fn(),
    putDecryptedContent: vi.fn()
  }
}))
vi.mock('./custom-emoji.service', () => ({ default: {} }))
vi.mock('./media-upload.service', () => ({ default: {} }))

const secret = generateSecretKey()
const pubkey = getPublicKey(secret)
const signEvent = vi.fn(async (draft: TDraftEvent) => finalizeEvent(draft, secret))
const signer = { getPublicKey: async () => pubkey, signEvent }
let stored: Map<number, Event>

beforeEach(() => {
  vi.clearAllMocks()
  stored = new Map()
  vi.mocked(indexedDb.getReplaceableEvent).mockImplementation(async (_, kind) => stored.get(kind))
  vi.mocked(indexedDb.putReplaceableEvent).mockImplementation(async (event) => {
    const existing = stored.get(event.kind)
    if (existing && existing.created_at > event.created_at) return existing
    stored.set(event.kind, event)
    return event
  })
  vi.mocked(client.publishEvent).mockResolvedValue(undefined)
})

describe('new account defaults', () => {
  it('publishes only the four agreed lists to fixed relays and updates caches', async () => {
    const result = await setupNewAccount(signer)
    expect(result.every((entry) => entry.status === 'fulfilled')).toBe(true)
    const events = vi.mocked(client.publishEvent).mock.calls.map(([relays, event]) => {
      expect(relays).toEqual(BIG_RELAY_URLS)
      return event
    })
    expect(events.map((event) => event.kind).sort((a, b) => a - b)).toEqual([
      3, 10000, 10002, 10063
    ])
    expect(events.find((event) => event.kind === 3)?.tags).toEqual([])
    expect(events.find((event) => event.kind === 10000)?.tags).toEqual([])
    expect(events.every((event) => event.content === '')).toBe(true)
    expect(events.find((event) => event.kind === 10002)?.tags).toEqual(
      BIG_RELAY_URLS.map((url) => ['r', url])
    )
    expect(events.find((event) => event.kind === 10063)?.tags).toEqual([
      ['server', JUMBLE_BLOSSOM_SERVER],
      ['server', 'https://blossom.band/']
    ])
    expect(client.updateFollowListCache).toHaveBeenCalledOnce()
    expect(client.updateRelayListCache).toHaveBeenCalledOnce()
    expect(client.updateBlossomServerListEventCache).toHaveBeenCalledOnce()
    expect(indexedDb.putDecryptedContent).toHaveBeenCalledWith(
      events.find((event) => event.kind === 10000)!.id,
      '[]'
    )
  })

  it('isolates signing failures so other lists can still be published', async () => {
    signEvent.mockRejectedValueOnce(new Error('Signing rejected'))
    const result = await setupNewAccount(signer)
    expect(result.filter((entry) => entry.status === 'rejected')).toHaveLength(1)
    expect(client.publishEvent).toHaveBeenCalledTimes(3)
  })

  it('finishes normally even if every relay publish fails', async () => {
    vi.mocked(client.publishEvent).mockRejectedValue(new Error('Offline'))
    const result = await setupNewAccount(signer)
    expect(result).toHaveLength(4)
    expect(result.every((entry) => entry.status === 'rejected')).toBe(true)
    expect(client.publishEvent).toHaveBeenCalledTimes(4)
  })

  it('waits for a slow list even after another list fails', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let started!: () => void
    const slowStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.mocked(client.publishEvent).mockImplementation(async (_, event) => {
      if (event.kind === 3) throw new Error('Offline')
      if (event.kind === 10063) {
        started()
        await pending
      }
    })
    let finished = false
    const setup = setupNewAccount(signer).then((results) => {
      finished = true
      return results
    })
    await slowStarted
    expect(finished).toBe(false)
    release()
    const results = await setup
    expect(finished).toBe(true)
    expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(3)
  })

  it('isolates cache failures from the remaining setup tasks', async () => {
    vi.mocked(client.updateBlossomServerListEventCache).mockRejectedValueOnce(new Error('DB busy'))
    const result = await setupNewAccount(signer)
    expect(result.filter((entry) => entry.status === 'rejected')).toHaveLength(1)
    expect(client.publishEvent).toHaveBeenCalledTimes(4)
  })

  it('preserves existing private mute content', async () => {
    const existing = finalizeEvent(
      { kind: 10000, tags: [], content: 'encrypted private tags', created_at: 1 },
      secret
    )
    stored.set(10000, existing)
    const result = await setupNewAccount(signer)
    expect(result[1]).toEqual({ status: 'fulfilled', value: existing })
    expect(indexedDb.putDecryptedContent).not.toHaveBeenCalled()
    expect(client.publishEvent).toHaveBeenCalledTimes(3)
  })

  it('rejects signatures from a different account', async () => {
    signEvent.mockResolvedValueOnce(
      finalizeEvent({ kind: 3, tags: [], content: '', created_at: 1 }, generateSecretKey())
    )
    const result = await setupNewAccount(signer)
    expect(result[0].status).toBe('rejected')
    expect(client.publishEvent).toHaveBeenCalledTimes(3)
  })
})
