import type { Event } from 'nostr-tools'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./indexed-db.service', () => ({
  default: { iterateProfileEvents: vi.fn() }
}))
vi.mock('./local-storage.service', () => ({
  default: {
    getAllowInsecureConnection: () => true,
    getFilterOutOnionRelays: () => false,
    getDefaultRelayUrls: () => ['wss://default.example/']
  }
}))
vi.mock('./relay-observation.service', () => ({
  default: { record: vi.fn(), setProtectedUrls: vi.fn() }
}))
vi.mock('@/lib/draft-event', () => ({ buildATag: vi.fn() }))
vi.mock('@/lib/platform', () => ({ isElectron: () => false }))

import client from './client.service'

const relayListSource = client as unknown as {
  fetchReplaceableEventsFromBigRelays: (
    pubkeys: string[],
    kind: number
  ) => Promise<(Event | null)[]>
}

const me = 'a'.repeat(64)
const other = 'b'.repeat(64)
const local = 'wss://localhost:7447/'
const publicRelay = 'wss://relay.example/'
const relayEvent = (pubkey: string, urls: string[], tag = 'r') =>
  ({ pubkey, tags: urls.map((url) => [tag, url]) }) as Event

beforeEach(() => {
  vi.restoreAllMocks()
  client.pubkey = me
  client.setOwnRelayUrls([])
  client.setCurrentRelays([])
})

describe('relays advertised by other users', () => {
  it('filters local relays before relay limits and excludes them from the displayed list', async () => {
    const localRelays = Array.from({ length: 9 }, (_, i) => `wss://192.168.1.${i + 1}/`)
    vi.spyOn(relayListSource, 'fetchReplaceableEventsFromBigRelays').mockResolvedValue([
      relayEvent(other, [...localRelays, publicRelay])
    ])

    const list = await client.fetchRelayList(other)
    expect(list.read).toEqual([publicRelay])
    expect(list.write).toEqual([publicRelay])
    expect(list.originalRelays).toEqual([{ url: publicRelay, scope: 'both' }])
  })

  it('allows only configured local URLs after normalization and follows configuration changes', async () => {
    vi.spyOn(relayListSource, 'fetchReplaceableEventsFromBigRelays').mockResolvedValue([
      relayEvent(other, [local, 'wss://localhost:7448/', publicRelay])
    ])
    client.setOwnRelayUrls(['wss://LOCALHOST:7447'])
    expect((await client.fetchRelayList(other)).write).toEqual([local, publicRelay])
    client.setOwnRelayUrls([])
    client.setCurrentRelays([local])
    expect((await client.fetchRelayList(other)).write).toEqual([publicRelay])
  })

  it('keeps the current user’s local relays and uses defaults if all foreign relays are local', async () => {
    vi.spyOn(relayListSource, 'fetchReplaceableEventsFromBigRelays').mockResolvedValue([
      relayEvent(me, [local]),
      relayEvent(other, [local])
    ])
    const [own, foreign] = await client.fetchRelayLists([me, other])
    expect(own.write).toEqual([local])
    expect(foreign.write).toEqual(['wss://default.example/'])
  })

  it('applies the same rule to DM relays without substituting defaults', async () => {
    const fetch = vi.spyOn(client, 'fetchDmRelaysEvent')
    fetch.mockResolvedValue(relayEvent(other, [local, publicRelay], 'relay'))
    expect(await client.fetchDmRelays(other)).toEqual([publicRelay])
    client.setOwnRelayUrls([local])
    expect(await client.fetchDmRelays(other)).toEqual([local, publicRelay])
    client.setOwnRelayUrls([])
    fetch.mockResolvedValue(relayEvent(other, [local], 'relay'))
    expect(await client.fetchDmRelays(other)).toEqual([])
    fetch.mockResolvedValue(relayEvent(me, [local], 'relay'))
    expect(await client.fetchDmRelays(me)).toEqual([local])
  })
})

describe('connection policy exceptions', () => {
  it('exempts configured local relays but keeps public ws relays subject to the setting', () => {
    const update = vi.spyOn(client.relayPool, 'setTrustedInsecureRelayUrls')
    client.setOwnRelayUrls(['ws://localhost:7447/', local, 'ws://relay.example/'])
    expect(update).toHaveBeenLastCalledWith(['ws://localhost:7447/', local])
  })

  it('does not grant automatic local access from the current user’s DM configuration', async () => {
    const update = vi.spyOn(client.relayPool, 'setTrustedInsecureRelayUrls')
    const fetch = vi.spyOn(client, 'fetchDmRelaysEvent')
    fetch.mockResolvedValue(relayEvent(me, [local], 'relay'))
    await client.fetchDmRelays(me)
    expect(update).not.toHaveBeenCalled()
    fetch.mockResolvedValue(relayEvent(other, [local, publicRelay], 'relay'))
    expect(await client.fetchDmRelays(other)).toEqual([publicRelay])
    client.setOwnRelayUrls([local])
    expect(await client.fetchDmRelays(other)).toEqual([local, publicRelay])
  })

  it('scopes signer permissions without treating them as configured mailboxes', async () => {
    const update = vi.spyOn(client.relayPool, 'setTrustedInsecureRelayUrls')
    const releaseFirst = client.acquireSignerRelayUrls([
      'wss://LOCALHOST:7447',
      'ws://public.example/'
    ])
    const releaseSecond = client.acquireSignerRelayUrls([local])
    expect(update).toHaveBeenLastCalledWith([local])
    vi.spyOn(relayListSource, 'fetchReplaceableEventsFromBigRelays').mockResolvedValue([
      relayEvent(other, [local, publicRelay])
    ])
    expect((await client.fetchRelayList(other)).write).toEqual([publicRelay])
    client.setCurrentRelays(['ws://browsing.example/'])
    releaseFirst()
    releaseFirst()
    expect(update).toHaveBeenLastCalledWith(['ws://browsing.example/', local])
    releaseSecond()
    expect(update).toHaveBeenLastCalledWith(['ws://browsing.example/'])
  })

  it('exempts explicit relay feeds immediately and removes the exception on leaving', () => {
    const update = vi.spyOn(client.relayPool, 'setTrustedInsecureRelayUrls')
    client.setOwnRelayUrls([local])
    client.setCurrentRelays(['ws://other.local/', 'ws://relay.example/'])
    expect(update).toHaveBeenLastCalledWith(['ws://other.local/', 'ws://relay.example/', local])
    client.setCurrentRelays([])
    expect(update).toHaveBeenLastCalledWith([local])
  })
})
