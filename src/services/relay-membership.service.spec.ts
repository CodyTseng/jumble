import type { Event } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/client.service', () => ({ default: { fetchEvents: vi.fn() } }))
vi.mock('@/services/local-storage.service', () => ({ default: {} }))
vi.mock('@/lib/event', () => ({
  sortEventsDesc: (events: Event[]) => [...events].sort((a, b) => b.created_at - a.created_at)
}))

const url = 'wss://relay.example/'
const user = 'a'.repeat(64)
const relay = 'b'.repeat(64)
const admin = 'c'.repeat(64)
const memberList = (members: string[]) =>
  ({ created_at: 1, tags: members.map((pubkey) => ['member', pubkey]) }) as Event

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('relay membership', () => {
  it('supports a relay with a self key and no administrator pubkey', async () => {
    const { checkNip43Support } = await import('@/lib/relay')
    expect(checkNip43Support({ url, shortUrl: url, supported_nips: [43], self: relay })).toBe(true)
    expect(checkNip43Support({ url, shortUrl: url, supported_nips: [43], pubkey: admin })).toBe(
      true
    )
    expect(checkNip43Support({ url, shortUrl: url, supported_nips: [43] })).toBe(false)
  })

  it('recognizes a member from the relay-signed list', async () => {
    const { default: client } = await import('./client.service')
    const { default: service } = await import('./relay-membership.service')
    vi.mocked(client.fetchEvents).mockResolvedValue([memberList([user])])
    expect(await service.checkMembership(url, user, relay)).toBe(true)
    expect(client.fetchEvents).toHaveBeenCalledWith([url], {
      kinds: [13534],
      authors: [relay],
      limit: 1
    })
  })

  it('retries an empty query instead of retaining a false membership result', async () => {
    const { default: client } = await import('./client.service')
    const { default: service } = await import('./relay-membership.service')
    vi.mocked(client.fetchEvents)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([memberList([user])])
    expect(await service.checkMembership(url, user, relay)).toBe(false)
    expect(await service.checkMembership(url, user, relay)).toBe(true)
    expect(client.fetchEvents).toHaveBeenCalledTimes(2)
  })

  it('preserves a successful join across equivalent URLs and removes a departing member', async () => {
    const { default: client } = await import('./client.service')
    const { default: service } = await import('./relay-membership.service')
    vi.mocked(client.fetchEvents).mockResolvedValue([])
    expect(await service.checkMembership(url, user, relay)).toBe(false)
    await service.addNewMember('wss://RELAY.example:443', user)
    expect(await service.checkMembership(url, user, relay)).toBe(true)
    await service.removeMember('wss://relay.example', user)
    expect(await service.checkMembership(url, user, relay)).toBe(false)
  })
})
