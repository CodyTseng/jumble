import { finalizeEvent, generateSecretKey, getPublicKey, kinds } from 'nostr-tools'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import client from './client.service'
import indexedDb, { TNipCdCatalogRecord } from './indexed-db.service'
import { NipCdService } from './nip-cd.service'

vi.mock('@/lib/draft-event', () => ({ buildATag: vi.fn() }))

vi.mock('./client.service', () => ({
  default: { fetchEvents: vi.fn(), fetchRelayList: vi.fn() }
}))
vi.mock('./local-storage.service', () => ({
  default: { getDefaultRelayUrls: () => ['wss://default.example/'] }
}))
vi.mock('./indexed-db.service', () => ({
  default: {
    getNipCdCatalogs: vi.fn(),
    putNipCdCatalog: vi.fn(),
    getManyReplaceableEvents: vi.fn()
  },
  MAX_NIP_CD_CATALOGS: 128
}))

const DAY = 24 * 60 * 60_000
const disk = new Map<string, TNipCdCatalogRecord>()
const a = generateSecretKey()
const b = generateSecretKey()
const executorA = getPublicKey(a)
const executorB = getPublicKey(b)

function declaration(secret: Uint8Array, kind: 1 | 14 | 1111, coordinate = 'hello') {
  return finalizeEvent(
    {
      kind: 31992,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: [
        ['d', coordinate],
        ['command', 'hello'],
        ['title', 'Hello'],
        ['description', 'Greet'],
        ['s', `kind:${kind}`]
      ]
    },
    secret
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  disk.clear()
  vi.mocked(indexedDb.getNipCdCatalogs).mockImplementation(async () =>
    structuredClone([...disk.values()])
  )
  vi.mocked(indexedDb.putNipCdCatalog).mockImplementation(async (record) => {
    disk.set(record.executor, structuredClone(record))
    return record
  })
  vi.mocked(client.fetchRelayList).mockResolvedValue({
    write: ['wss://outbox.example/'],
    read: ['wss://inbox.example/'],
    originalRelays: []
  })
})
afterEach(() => vi.useRealTimers())

describe('NIP-CD persisted catalogs', () => {
  it('bare slash and executor names are local-only, even with multiple executors', async () => {
    disk.set(executorA, { executor: executorA, checkedAt: Date.now(), events: [declaration(a, 1)] })
    disk.set(executorB, {
      executor: executorB,
      checkedAt: Date.now(),
      events: [declaration(b, 1111)]
    })
    const profile = finalizeEvent(
      {
        kind: kinds.Metadata,
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        content: JSON.stringify({ name: 'Local test profile' })
      },
      a
    )
    vi.mocked(indexedDb.getManyReplaceableEvents).mockResolvedValue([profile, null])
    const service = new NipCdService()
    expect((await service.getCachedCommands()).map((command) => command.executor)).toEqual([
      executorA,
      executorB
    ])
    expect((await service.getCachedCommands(executorB)).map((command) => command.executor)).toEqual(
      [executorB]
    )
    expect(await service.getCachedExecutorNames([executorA, executorB])).toEqual(
      new Map([[executorA, 'Local test profile']])
    )
    expect(indexedDb.getManyReplaceableEvents).toHaveBeenCalledExactlyOnceWith(
      [executorA, executorB],
      kinds.Metadata
    )
    expect(client.fetchRelayList).not.toHaveBeenCalled()
    expect(client.fetchEvents).not.toHaveBeenCalled()
  })

  it('an already-loaded tab sees another tab’s writes on the next local reload', async () => {
    const alreadyOpen = new NipCdService()
    expect(await alreadyOpen.getCachedCommands()).toEqual([])
    const secondTab = new NipCdService()
    vi.mocked(client.fetchEvents).mockResolvedValue([declaration(b, 1)])
    expect(await secondTab.refresh(executorB)).toBe(true)
    expect(await alreadyOpen.getCachedCommands()).toEqual([])
    vi.clearAllMocks()
    await alreadyOpen.reloadCachedCatalogs()
    expect(await alreadyOpen.getCachedCommands()).toMatchObject([{ executor: executorB }])
    expect(indexedDb.getNipCdCatalogs).toHaveBeenCalledOnce()
    expect(client.fetchRelayList).not.toHaveBeenCalled()
    expect(client.fetchEvents).not.toHaveBeenCalled()
  })

  it('preserves memory when a reload fails or the previous write could not reach disk', async () => {
    const service = new NipCdService()
    vi.mocked(indexedDb.putNipCdCatalog).mockRejectedValueOnce(new Error('storage unavailable'))
    vi.mocked(client.fetchEvents).mockResolvedValue([declaration(a, 1)])
    expect(await service.refresh(executorA)).toBe(true)
    vi.mocked(indexedDb.getNipCdCatalogs).mockRejectedValueOnce(new Error('storage unavailable'))
    await service.reloadCachedCatalogs()
    expect(await service.getCachedCommands()).toMatchObject([{ executor: executorA }])
    await service.reloadCachedCatalogs()
    expect(await service.getCachedCommands()).toMatchObject([{ executor: executorA }])
  })

  it('deduplicates discovery and stores both public kinds in one catalog available after restart', async () => {
    const service = new NipCdService()
    vi.mocked(client.fetchEvents).mockResolvedValue([
      declaration(a, 1),
      declaration(a, 1111, 'comment')
    ])
    const onQuery = vi.fn()
    const onCoalescedQuery = vi.fn()
    const first = service.refresh(executorA, onQuery)
    expect(service.refresh(executorA, onCoalescedQuery)).toBe(first)
    expect(await first).toBe(true)
    expect(onQuery).toHaveBeenCalledOnce()
    expect(onCoalescedQuery).toHaveBeenCalledOnce()
    expect(client.fetchRelayList).toHaveBeenCalledExactlyOnceWith(executorA)
    expect(client.fetchEvents).toHaveBeenCalledExactlyOnceWith(
      [
        'wss://outbox.example/',
        'wss://default.example/',
        'wss://nos.lol/',
        'wss://relay.primal.net/',
        'wss://relay.ditto.pub/'
      ],
      [
        { kinds: [31992], authors: [executorA], limit: 256 },
        { kinds: [5], authors: [executorA], limit: 256 }
      ]
    )
    const reloaded = new NipCdService()
    expect((await reloaded.getCachedCommands()).map((command) => command.id).sort()).toEqual([
      'comment',
      'hello'
    ])
    const whenFresh = vi.fn()
    expect(await reloaded.refresh(executorA, whenFresh)).toBe(false)
    expect(whenFresh).not.toHaveBeenCalled()
    expect(client.fetchEvents).toHaveBeenCalledOnce()
  })

  it('shows stale results during refresh and keeps them on empty/failed relay reads', async () => {
    const service = new NipCdService()
    vi.mocked(client.fetchEvents).mockResolvedValueOnce([declaration(a, 1)])
    await service.refresh(executorA)
    await vi.advanceTimersByTimeAsync(3 * DAY + 1)

    let finish!: (events: []) => void
    vi.mocked(client.fetchEvents).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const refreshing = service.refresh(executorA)
    expect(await service.getCachedCommands(executorA)).toHaveLength(1)
    finish([])
    expect(await refreshing).toBe(false)
    expect(await new NipCdService().getCachedCommands(executorA)).toHaveLength(1)
    expect(await service.refresh(executorA)).toBe(false)
    expect(client.fetchEvents).toHaveBeenCalledTimes(2)
    expect(indexedDb.putNipCdCatalog).toHaveBeenCalledOnce()
  })

  it('persists a signed withdrawal against old relay copies and retains a newer DM-only replacement', async () => {
    const service = new NipCdService()
    const prior = declaration(a, 1)
    vi.mocked(client.fetchEvents).mockResolvedValueOnce([prior])
    await service.refresh(executorA)

    await vi.advanceTimersByTimeAsync(3 * DAY + 1)
    const deleted = finalizeEvent(
      {
        kind: kinds.EventDeletion,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [['a', `31992:${executorA}:hello`]]
      },
      a
    )
    vi.mocked(client.fetchEvents).mockResolvedValueOnce([deleted])
    await service.refresh(executorA)
    expect(await new NipCdService().getCachedCommands(executorA)).toEqual([])

    await vi.advanceTimersByTimeAsync(3 * DAY + 1)
    const dm = declaration(a, 14)
    vi.mocked(client.fetchEvents).mockResolvedValueOnce([prior, dm])
    await service.refresh(executorA)
    expect(await new NipCdService().getCachedCommands(executorA)).toMatchObject([
      { executor: executorA, scopes: [{ group: 'kind', value: '14' }] }
    ])
  })
})
