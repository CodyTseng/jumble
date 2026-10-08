import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyRelayObservation, RelayObservationRecord } from '@/lib/relay-observation'

const db = vi.hoisted(() => ({ getRelayObservations: vi.fn(), saveRelayObservations: vi.fn() }))
vi.mock('./indexed-db.service', () => ({ default: db }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  db.getRelayObservations.mockReset().mockResolvedValue([])
  db.saveRelayObservations.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'visible' })
  vi.stubGlobal('window', { addEventListener: vi.fn() })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const url = 'wss://relay.example/'
const connection = () => ({ type: 'connection' as const, url, at: Date.now(), duration: 120 })

describe('relay observation persistence', () => {
  it('shows activity while loading and merges it with existing data exactly once', async () => {
    let resolveLoad!: (records: RelayObservationRecord[]) => void
    db.getRelayObservations.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve
      })
    )
    const service = (await import('./relay-observation.service')).default
    service.record({ ...connection(), url: 'wss://RELAY.example:443' })
    expect(service.get(url)?.days[0].connections).toBe(1)
    const stored: RelayObservationRecord = { url, updatedAt: 0, days: [] }
    for (let i = 0; i < 3; i++) applyRelayObservation(stored, connection())
    resolveLoad([stored])
    await service.flush()
    expect(service.get(url)?.days[0].connections).toBe(4)
    const [deltas] = db.saveRelayObservations.mock.calls[0]
    expect(deltas).toHaveLength(1)
    expect(deltas[0].days[0].connections).toBe(1)
  })

  it('batches operations into daily counters and protects configured relays', async () => {
    const service = (await import('./relay-observation.service')).default
    service.setProtectedUrls(['wss://RELAY.example:443'])
    for (let i = 0; i < 100; i++) service.record(connection())
    expect(db.saveRelayObservations).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(db.saveRelayObservations).toHaveBeenCalledOnce()
    const [deltas, protectedUrls] = db.saveRelayObservations.mock.calls[0]
    expect(deltas[0].days[0].connections).toBe(100)
    expect(protectedUrls).toEqual([url])
  })

  it('retains aggregate deltas after a failed write without duplicating memory counts', async () => {
    const service = (await import('./relay-observation.service')).default
    db.saveRelayObservations.mockRejectedValueOnce(new Error('storage unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    service.record(connection())
    await service.flush()
    service.record(connection())
    await service.flush()
    expect(db.saveRelayObservations.mock.calls[1][0][0].days[0].connections).toBe(2)
    expect(service.get(url)?.days[0].connections).toBe(2)
    warn.mockRestore()
  })

  it('limits automatically discovered relays but keeps configured relays', async () => {
    const service = (await import('./relay-observation.service')).default
    service.setProtectedUrls([
      url,
      ...Array.from({ length: 100 }, (_, index) => `wss://unused-${index}.example/`)
    ])
    service.record(connection())
    for (let i = 0; i < 510; i++)
      service.record({ ...connection(), url: `wss://relay-${i}.example/`, at: Date.now() + i + 1 })
    expect(service.list()).toHaveLength(501)
    expect(service.get(url)).toBeDefined()
    await service.flush()
    expect(db.saveRelayObservations.mock.calls[0][0]).toHaveLength(501)
  })
})
