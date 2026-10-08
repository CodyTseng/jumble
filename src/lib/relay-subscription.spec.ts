import type { Filter } from 'nostr-tools'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IRelay, IRelayPool, TSubHandlers } from '@/types/relay-pool'
import { RELAY_SUBSCRIPTION_EOSE_TIMEOUT, subscribeRelays } from './relay-subscription'

class FakeRelay implements IRelay {
  publishTimeout = 10_000
  handlers?: TSubHandlers
  subscribeCount = 0

  constructor(readonly url: string) {}

  async publish() {}
  async auth() {}

  subscribe(_filters: Filter[], handlers: TSubHandlers) {
    this.handlers = handlers
    this.subscribeCount++
    return { close: () => {} }
  }

  emitEose() {
    this.handlers?.oneose?.()
  }

  emitClose(reason: string) {
    this.handlers?.onclose?.(reason)
  }
}

class FakePool implements IRelayPool {
  trackRelays = true
  relays = new Map<string, FakeRelay>()

  async ensureRelay(url: string): Promise<IRelay> {
    let relay = this.relays.get(url)
    if (!relay) {
      relay = new FakeRelay(url)
      this.relays.set(url, relay)
    }
    return relay
  }

  close() {}
  setAllowInsecure() {}
  setTrustedInsecureRelayUrls() {}
  getSeenRelays() {
    return []
  }
  trackEventSeen() {}
}

describe('subscribeRelays', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('measures first data once, including events suppressed by deduplication', async () => {
    const pool = new FakePool()
    const observe = vi.fn()
    subscribeRelays(pool, ['wss://one.example'], [{}], { observe, alreadyHaveEvent: () => true })
    await flushPromises()
    const relay = pool.relays.get('wss://one.example')!
    relay.handlers!.onrequest?.(Date.now())
    await vi.advanceTimersByTimeAsync(120)
    relay.handlers!.ondata?.()
    relay.handlers!.ondata?.()
    relay.emitEose()
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'read-time', duration: 120 })
    )
  })

  it('does not treat empty EOSE or later live events as initial read latency', async () => {
    const pool = new FakePool()
    const observe = vi.fn()
    subscribeRelays(pool, ['wss://one.example'], [{}], { observe })
    await flushPromises()
    const relay = pool.relays.get('wss://one.example')!
    relay.handlers!.onrequest?.(Date.now())
    relay.emitEose()
    relay.handlers!.ondata?.()
    await vi.advanceTimersByTimeAsync(RELAY_SUBSCRIPTION_EOSE_TIMEOUT)
    expect(observe).not.toHaveBeenCalled()
  })

  it('records one completion timeout, and does not mistake cancellation for timeout', async () => {
    const pool = new FakePool()
    const observe = vi.fn()
    const sub = subscribeRelays(pool, ['wss://one.example'], [{}], { observe })
    await flushPromises()
    const relay = pool.relays.get('wss://one.example')!
    relay.handlers!.onrequest?.(Date.now())
    relay.handlers!.ondata?.()
    relay.handlers!.ontimeout?.()
    relay.handlers!.ontimeout?.()
    expect(observe.mock.calls.filter(([item]) => item.type === 'read-timeout')).toEqual([
      [expect.objectContaining({ phase: 'completion' })]
    ])
    sub.close()
    await vi.advanceTimersByTimeAsync(RELAY_SUBSCRIPTION_EOSE_TIMEOUT)
    expect(observe).toHaveBeenCalledTimes(2)
  })

  it('counts a sent query deadline but not time spent waiting for a connection', async () => {
    const pool = new FakePool()
    const observe = vi.fn()
    subscribeRelays(pool, ['wss://one.example', 'wss://two.example'], [{}], { observe })
    await flushPromises()
    pool.relays.get('wss://one.example')!.handlers!.onrequest?.(Date.now())
    await vi.advanceTimersByTimeAsync(RELAY_SUBSCRIPTION_EOSE_TIMEOUT)
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'read-timeout',
        url: 'wss://one.example',
        phase: 'first-event'
      })
    )
  })

  it.each([
    'auth-required: restricted',
    'ERROR: auth-required: requested filter requires authentication',
    'subscription rejected (AUTH-REQUIRED)'
  ])('does not count %s as rejection or timeout after a successful retry', async (reason) => {
    const pool = new FakePool()
    const observe = vi.fn()
    subscribeRelays(pool, ['wss://one.example'], [{}], {
      observe,
      getAuthenticator: () => async () => {}
    })
    await flushPromises()
    const relay = pool.relays.get('wss://one.example')!
    relay.handlers!.onrequest?.(Date.now())
    await vi.advanceTimersByTimeAsync(100)
    relay.emitClose(reason)
    await flushPromises()
    relay.handlers!.onrequest?.(Date.now())
    await vi.advanceTimersByTimeAsync(100)
    relay.handlers!.ondata?.()
    relay.emitEose()
    await vi.advanceTimersByTimeAsync(RELAY_SUBSCRIPTION_EOSE_TIMEOUT)
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'read-time', duration: 200 })
    )
  })

  it('records a final auth refusal after successful authentication without retrying indefinitely', async () => {
    const pool = new FakePool()
    const observe = vi.fn()
    const authenticate = vi.fn(async () => {})
    subscribeRelays(pool, ['wss://one.example'], [{}], {
      observe,
      getAuthenticator: () => authenticate
    })
    await flushPromises()
    const relay = pool.relays.get('wss://one.example')!
    relay.handlers!.onrequest?.(Date.now())
    const reason = 'ERROR: auth-required: requested filter requires authentication'
    relay.emitClose(reason)
    await flushPromises()
    relay.emitClose(reason)
    expect(authenticate).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'read-rejection', reason })
    )
  })

  it('aggregates a final refusal once and separates unavailable authentication', async () => {
    const pool = new FakePool()
    const observe = vi.fn()
    subscribeRelays(pool, ['wss://one.example', 'wss://two.example'], [{}], { observe })
    await flushPromises()
    const one = pool.relays.get('wss://one.example')!
    const two = pool.relays.get('wss://two.example')!
    one.handlers!.onrequest?.(Date.now())
    two.handlers!.onrequest?.(Date.now())
    one.emitClose('restricted: members only')
    one.emitClose('restricted: members only')
    two.emitClose('ERROR: auth-required: login')
    await vi.advanceTimersByTimeAsync(RELAY_SUBSCRIPTION_EOSE_TIMEOUT)
    expect(observe.mock.calls.map(([item]) => item.type)).toEqual(['read-rejection'])
  })

  it('settles when some relays EOSE and another relay closes', async () => {
    const pool = new FakePool()
    const oneose = vi.fn()
    subscribeRelays(pool, ['wss://one.example', 'wss://two.example'], [{}], { oneose })
    await flushPromises()

    pool.relays.get('wss://one.example')!.emitEose()
    pool.relays.get('wss://two.example')!.emitClose('rate-limited')

    expect(oneose).toHaveBeenNthCalledWith(1, false)
    expect(oneose).toHaveBeenNthCalledWith(2, true)
  })

  it('uses an absolute EOSE deadline that includes connection time', async () => {
    const pool = new FakePool()
    pool.ensureRelay = async () => await new Promise<IRelay>(() => {})
    const oneose = vi.fn()
    subscribeRelays(pool, ['wss://silent.example'], [{}], { oneose })

    await vi.advanceTimersByTimeAsync(RELAY_SUBSCRIPTION_EOSE_TIMEOUT)

    expect(oneose).toHaveBeenCalledOnce()
    expect(oneose).toHaveBeenCalledWith(true)
  })

  it('settles an auth-required relay when authentication fails', async () => {
    const pool = new FakePool()
    const oneose = vi.fn()
    const onclose = vi.fn()
    const authenticate = vi.fn(async () => {
      throw new Error('auth failed')
    })
    subscribeRelays(pool, ['wss://auth.example'], [{}], {
      oneose,
      onclose,
      getAuthenticator: () => authenticate
    })
    await flushPromises()

    pool.relays.get('wss://auth.example')!.emitClose('auth-required: restricted')
    await flushPromises()

    expect(authenticate).toHaveBeenCalledOnce()
    expect(oneose).toHaveBeenCalledWith(true)
    expect(onclose).toHaveBeenCalledWith('wss://auth.example', 'auth-required: restricted')
  })

  it('resubscribes after successful authentication while the caller remains active', async () => {
    const pool = new FakePool()
    const authenticate = vi.fn(async () => undefined)
    subscribeRelays(pool, ['wss://auth.example'], [{}], {
      getAuthenticator: () => authenticate
    })
    await flushPromises()

    const relay = pool.relays.get('wss://auth.example')!
    relay.emitClose('auth-required: restricted')
    await flushPromises()

    expect(relay.subscribeCount).toBe(2)
  })

  it('settles an empty relay list asynchronously', async () => {
    const oneose = vi.fn()
    subscribeRelays(new FakePool(), [], [{}], { oneose })
    expect(oneose).not.toHaveBeenCalled()

    await flushPromises()

    expect(oneose).toHaveBeenCalledWith(true)
  })
})

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
