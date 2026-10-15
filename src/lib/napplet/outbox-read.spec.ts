import { afterEach, describe, expect, it, vi } from 'vitest'
import { finalizeEvent } from 'nostr-tools'
import { Observable, Subject } from 'rxjs'
import { OutboxEventStore } from './vendor/nostr/src/outbox-store'
import type { ReadMessage } from './vendor/nostr/src/playback'

const relays = ['wss://one.example/', 'wss://two.example/']
const event = finalizeEvent(
  { kind: 1, content: 'read fixture', tags: [], created_at: 1 },
  new Uint8Array(32).fill(3)
)
const stores: OutboxEventStore[] = []
afterEach(() => {
  stores.forEach((store) => store.close())
  stores.length = 0
  vi.useRealTimers()
})
function fixture() {
  const wire = new Subject<ReadMessage>()
  const release = vi.fn()
  const req = vi.fn(
    () =>
      new Observable<ReadMessage>((observer) => {
        const subscription = wire.subscribe(observer)
        return () => {
          subscription.unsubscribe()
          release()
        }
      })
  )
  const store = new OutboxEventStore({ req, close() {} }, relays)
  stores.push(store)
  return { wire, release, req, store }
}

describe('OUTBOX reads over Jumble transport', () => {
  it('verifies matching events and waits for every selected relay before claiming coverage', async () => {
    const { wire, release, req, store } = fixture()
    let settled = false
    const result = store.loadEventWithCoverage(event.id, relays, 500)
    void result.then(() => {
      settled = true
    })
    wire.next({ type: 'EVENT', from: relays[0], event: { ...event, sig: '0'.repeat(128) } })
    wire.next({ type: 'EVENT', from: relays[0], event })
    wire.next({ type: 'EVENT', from: relays[1], event })
    wire.next({ type: 'EOSE', from: relays[0] })
    await Promise.resolve()
    expect(settled).toBe(false)
    wire.next({ type: 'EOSE', from: relays[1] })
    expect(await result).toEqual({ events: [event], incomplete: false })
    expect(req).toHaveBeenCalledWith(relays, [{ ids: [event.id], limit: 1 }], expect.anything())
    expect(store.observedRelays(event.id)).toEqual(relays)
    expect(release).toHaveBeenCalledOnce()
  })

  it('keeps cached data advisory when a relay fails and still attempts a network read', async () => {
    const { wire, req, store } = fixture()
    store.ingest(event)
    const result = store.loadEventWithCoverage(event.id, relays, 500)
    wire.next({ type: 'CLOSED', from: relays[0], reason: 'blocked' })
    wire.next({ type: 'EOSE', from: relays[1] })
    expect(await result).toMatchObject({
      events: [event],
      incomplete: true,
      error: expect.any(String)
    })
    expect(req).toHaveBeenCalledOnce()
  })

  it.each(['abort', 'close'] as const)(
    'settles pending reads and closes subscriptions on %s',
    async (action) => {
      const { release, store } = fixture()
      const controller = new AbortController()
      const result = store.loadEventWithCoverage(event.id, relays, 500, controller.signal)
      if (action === 'abort') controller.abort()
      else store.close()
      expect(await result).toMatchObject({ incomplete: true, error: expect.any(String) })
      expect(release).toHaveBeenCalledOnce()
    }
  )

  it('returns partial data on timeout without leaving a relay subscription', async () => {
    vi.useFakeTimers()
    const { wire, release, store } = fixture()
    const result = store.loadEventWithCoverage(event.id, relays, 50)
    wire.next({ type: 'EVENT', from: relays[0], event })
    await vi.advanceTimersByTimeAsync(50)
    expect(await result).toMatchObject({
      events: [event],
      incomplete: true,
      error: expect.any(String)
    })
    expect(release).toHaveBeenCalledOnce()
  })

  it('does not share cached records between sessions and expires raw records', () => {
    let now = 1000
    const wire = new Subject<ReadMessage>()
    const store = new OutboxEventStore({ req: () => wire, close() {} }, relays, {
      now: () => now,
      ttlMs: 10
    })
    stores.push(store)
    store.ingest(event)
    expect(store.cached([{}])).toEqual([event])
    expect(fixture().store.cached([{}])).toEqual([])
    now += 10
    expect(store.cached([{}])).toEqual([])
  })
})
