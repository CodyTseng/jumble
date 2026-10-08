import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SmartPool } from './smart-pool'
import type { RelayObserver } from './relay-observation'

const RELAY_URL = 'wss://relay.example.com'

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []
  static connectionFailuresRemaining = 0
  static acknowledgePublishes = true

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { message: string }) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(url: string | URL) {
    this.url = url.toString()
    FakeWebSocket.instances.push(this)
    queueMicrotask(() => {
      if (FakeWebSocket.connectionFailuresRemaining > 0) {
        FakeWebSocket.connectionFailuresRemaining--
        this.readyState = FakeWebSocket.CLOSED
        this.onerror?.()
        return
      }
      this.readyState = FakeWebSocket.OPEN
      this.onopen?.()
    })
  }

  send(message: string) {
    this.sent.push(message)
    if (message.startsWith('["AUTH"')) {
      const eventId = JSON.parse(message)[1].id
      queueMicrotask(() =>
        this.onmessage?.({ data: JSON.stringify(['OK', eventId, true, 'authenticated']) })
      )
      return
    }
    if (message.startsWith('["EVENT"')) {
      if (!FakeWebSocket.acknowledgePublishes) return
      const eventId = JSON.parse(message)[1].id
      queueMicrotask(() =>
        this.onmessage?.({ data: JSON.stringify(['OK', eventId, true, 'accepted']) })
      )
      return
    }
    if (!message.startsWith('["REQ"')) return

    const subId = JSON.parse(message)[1]
    queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(['EOSE', subId]) }))
  }

  close() {
    if (this.readyState >= FakeWebSocket.CLOSING) return
    this.readyState = FakeWebSocket.CLOSING
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.CLOSED
      this.onclose?.({ message: '' })
    })
  }

  hardClose() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ message: 'connection lost' })
  }
}

describe('SmartPool request-driven relay lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    FakeWebSocket.connectionFailuresRemaining = 0
    FakeWebSocket.acknowledgePublishes = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('observes every real connection attempt, including automatic retries', async () => {
    FakeWebSocket.connectionFailuresRemaining = 1
    const observe = vi.fn()
    const pool = createPool(observe)
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], {})
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(observe.mock.calls.map(([item]) => item.reason === undefined)).toEqual([false, true])
    expect(observe.mock.calls.every(([item]) => item.type === 'connection')).toBe(true)
    sub.close()
  })

  it('distinguishes a real EOSE from the library synthetic EOSE deadline', async () => {
    const pool = createPool()
    const ontimeout = vi.fn()
    const oneose = vi.fn()
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { ontimeout, oneose })
    await waitForReq(FakeWebSocket.instances[0])
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10000)
    expect(oneose).toHaveBeenCalledOnce()
    expect(ontimeout).not.toHaveBeenCalled()
    sub.close()

    const silent = createPool()
    const second = silent.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { ontimeout, oneose })
    const socket = FakeWebSocket.instances[1]
    socket.send = function (message) {
      this.sent.push(message)
    }
    await waitForReq(socket)
    await vi.advanceTimersByTimeAsync(10000)
    expect(ontimeout).toHaveBeenCalledOnce()
    expect(oneose).toHaveBeenCalledTimes(2)
    second.close()
  })

  it('keeps a REQ managed until its caller closes it after EOSE', async () => {
    const pool = createPool()
    const oneose = vi.fn()
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn(), oneose })
    await waitForReq(FakeWebSocket.instances[0])
    await flushPromises()

    expect(oneose).toHaveBeenCalledOnce()
    expect(pool.listConnectionStatus().size).toBe(1)
    sub.close()
    expect(pool.listConnectionStatus().size).toBe(0)
  })

  it('keeps a stable managed relay while used and discards it after its last REQ closes', async () => {
    const pool = createPool()
    const relay = pool.getRelay(RELAY_URL)
    const first = relay.subscribe([{ kinds: [1] }], { onevent: vi.fn() })
    const second = relay.subscribe([{ kinds: [2] }], { onevent: vi.fn() })
    await waitForReqCount(FakeWebSocket.instances[0], 2)

    expect(pool.getRelay(RELAY_URL)).toBe(relay)
    await expect(pool.ensureRelay(RELAY_URL)).resolves.toBe(relay)
    expect('openSubs' in relay).toBe(false)

    first.close()
    expect(pool.listConnectionStatus().size).toBe(1)

    second.close()
    expect(pool.listConnectionStatus().size).toBe(0)
    await expect(pool.ensureRelay(RELAY_URL)).resolves.not.toBe(relay)
  })

  it('keeps the managed connection alive for an auth-required replacement REQ', async () => {
    const pool = createPool()
    const relay = pool.getRelay(RELAY_URL)
    let replacement: { close: () => void } | undefined
    relay.subscribe([{ kinds: [1] }], {
      onevent: vi.fn(),
      onclose: (reason) => {
        if (!reason.startsWith('auth-required')) return
        void relay
          .auth(
            async (template) =>
              ({
                ...template,
                id: 'auth-event-id',
                pubkey: 'pubkey',
                sig: 'signature'
              }) as never
          )
          .then(() => {
            replacement = relay.subscribe([{ kinds: [1] }], { onevent: vi.fn() })
          })
      }
    })
    const socket = FakeWebSocket.instances[0]
    await waitForReq(socket)
    socket.onmessage?.({ data: JSON.stringify(['AUTH', 'challenge']) })
    const subId = JSON.parse(socket.sent.find((message) => message.startsWith('["REQ"'))!)[1]
    socket.onmessage?.({ data: JSON.stringify(['CLOSED', subId, 'auth-required: please auth']) })
    await flushPromises()
    await waitForReqCount(socket, 2)
    await vi.advanceTimersByTimeAsync(0)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(pool.listConnectionStatus().size).toBe(1)
    replacement?.close()
  })

  it('does not recycle a relay while a transient publish is connecting', async () => {
    const pool = createPool()
    const publish = pool.getRelay(RELAY_URL).publish({ id: 'event-id' } as never)

    await pool.checkRelays()
    await publish

    expect(FakeWebSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(pool.listConnectionStatus().size).toBe(0)
  })

  it('does not interrupt an in-flight publish while checking an active REQ relay', async () => {
    const pool = createPool()
    const relay = pool.getRelay(RELAY_URL)
    const sub = relay.subscribe([{ kinds: [1] }], { onevent: vi.fn() })
    await waitForReq(FakeWebSocket.instances[0])

    const publish = relay.publish({ id: 'event-id' } as never)
    await pool.checkRelays()
    await publish

    expect(FakeWebSocket.instances).toHaveLength(1)
    sub.close()
  })

  it('recycles a timed-out publish connection inside the managed relay', async () => {
    const pool = createPool()
    const relay = pool.getRelay(RELAY_URL)
    const sub = relay.subscribe([{ kinds: [1] }], { onevent: vi.fn() })
    await waitForReq(FakeWebSocket.instances[0])

    FakeWebSocket.acknowledgePublishes = false
    relay.publishTimeout = 100
    const publish = relay.publish({ id: 'event-id' } as never)
    const rejected = expect(publish).rejects.toThrow('publish timed out')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(getReqFilters(FakeWebSocket.instances[1])).toEqual([{ kinds: [1] }])
    sub.close()
  })

  it('deduplicates synchronous connection-policy failures per managed relay', async () => {
    const pool = createPool()
    const firstOnClose = vi.fn()
    const secondOnClose = vi.fn()
    const insecureRelay = pool.getRelay('ws://relay.example.com')
    insecureRelay.subscribe([{ kinds: [1] }], { onevent: vi.fn(), onclose: firstOnClose })
    insecureRelay.subscribe([{ kinds: [2] }], { onevent: vi.fn(), onclose: secondOnClose })

    await flushPromises()
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(firstOnClose).toHaveBeenCalledWith(
      expect.stringContaining('relay connection unavailable after 3 attempts')
    )
    expect(secondOnClose).toHaveBeenCalledOnce()
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('replaces demanded connections on resume and restores the original REQ', async () => {
    const pool = createPool()
    const filters = [{ kinds: [1], since: 100 }]
    const oneose = vi.fn()
    const sub = pool.getRelay(RELAY_URL).subscribe(filters, { onevent: vi.fn(), oneose })
    await waitForReq(FakeWebSocket.instances[0])
    await flushPromises()

    await pool.checkRelays()
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(Array.from(pool.listConnectionStatus().values())).toEqual([true])
    expect(getReqFilters(FakeWebSocket.instances[1])).toEqual(filters)
    expect(filters).toEqual([{ kinds: [1], since: 100 }])
    expect(oneose).toHaveBeenCalledOnce()
    sub.close()
    expect(pool.listConnectionStatus().size).toBe(0)
  })

  it('reconnects a dropped relay while active REQ demand exists', async () => {
    const pool = createPool()
    const sub = pool
      .getRelay(RELAY_URL)
      .subscribe([{ kinds: [1059], '#p': ['recipient'] }], { onevent: vi.fn() })
    await waitForReq(FakeWebSocket.instances[0])

    FakeWebSocket.instances[0].hardClose()
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(getReqFilters(FakeWebSocket.instances[1])).toEqual([
      { kinds: [1059], '#p': ['recipient'] }
    ])
    sub.close()
  })

  it('stops after three connection failures and reports the terminal failure', async () => {
    const pool = createPool()
    const firstOnClose = vi.fn()
    const secondOnClose = vi.fn()
    const firstOnEose = vi.fn()
    const secondOnEose = vi.fn()
    FakeWebSocket.connectionFailuresRemaining = 3

    pool
      .getRelay(RELAY_URL)
      .subscribe([{ kinds: [1] }], { onevent: vi.fn(), oneose: firstOnEose, onclose: firstOnClose })
    pool
      .getRelay(RELAY_URL)
      .subscribe([{ kinds: [2] }], {
        onevent: vi.fn(),
        oneose: secondOnEose,
        onclose: secondOnClose
      })

    await flushPromises()
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(3)
    expect(firstOnClose).toHaveBeenCalledWith(
      'relay connection unavailable after 3 attempts: connection failed'
    )
    expect(secondOnClose).toHaveBeenCalledWith(
      'relay connection unavailable after 3 attempts: connection failed'
    )
    expect(firstOnEose).toHaveBeenCalledOnce()
    expect(secondOnEose).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it('actively reconnects a dropped connection but reports repeated reconnect failures', async () => {
    const pool = createPool()
    const onclose = vi.fn()
    pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn(), onclose })
    await waitForReq(FakeWebSocket.instances[0])

    FakeWebSocket.connectionFailuresRemaining = 3
    FakeWebSocket.instances[0].hardClose()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(4)
    expect(onclose).toHaveBeenCalledWith(
      'relay connection unavailable after 3 attempts: connection failed'
    )
  })

  it('pauses connection attempts while offline and resumes with a fresh budget', async () => {
    const pool = createPool()
    const onclose = vi.fn()
    pool.setNetworkOnline(false)

    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn(), onclose })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(onclose).not.toHaveBeenCalled()

    pool.setNetworkOnline(true)
    await pool.checkRelays()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(getReqFilters(FakeWebSocket.instances[0])).toEqual([{ kinds: [1] }])
    sub.close()
  })

  it('cancels a pending retry when the browser goes offline', async () => {
    const pool = createPool()
    const onclose = vi.fn()
    FakeWebSocket.connectionFailuresRemaining = 1
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn(), onclose })
    await flushPromises()
    expect(FakeWebSocket.instances).toHaveLength(1)

    pool.setNetworkOnline(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(onclose).not.toHaveBeenCalled()

    pool.setNetworkOnline(true)
    await pool.checkRelays()
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(getReqFilters(FakeWebSocket.instances[1])).toEqual([{ kinds: [1] }])
    sub.close()
  })

  it('does not spend retries when an established relay drops while offline', async () => {
    const pool = createPool()
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn() })
    await waitForReq(FakeWebSocket.instances[0])

    pool.setNetworkOnline(false)
    FakeWebSocket.instances[0].hardClose()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(FakeWebSocket.instances).toHaveLength(1)

    pool.setNetworkOnline(true)
    await pool.checkRelays()
    expect(FakeWebSocket.instances).toHaveLength(2)
    sub.close()
  })

  it('does not resurrect REQ demand cancelled during retry backoff', async () => {
    const pool = createPool()
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn() })
    await waitForReq(FakeWebSocket.instances[0])

    FakeWebSocket.instances[0].hardClose()
    sub.close()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(pool.listConnectionStatus().size).toBe(0)
  })

  it('releases connected relays without active REQs on resume', async () => {
    const pool = createPool()
    await pool.getRelay(RELAY_URL).publish({ id: 'event-id' } as never)

    await pool.checkRelays()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(pool.listConnectionStatus().size).toBe(0)
  })

  it('deduplicates concurrent resume recovery', async () => {
    const pool = createPool()
    const sub = pool.getRelay(RELAY_URL).subscribe([{ kinds: [1] }], { onevent: vi.fn() })
    await waitForReq(FakeWebSocket.instances[0])

    const first = pool.checkRelays()
    const second = pool.checkRelays()

    expect(second).toBe(first)
    await first
    expect(FakeWebSocket.instances).toHaveLength(2)
    sub.close()
  })
})

function createPool(observe?: RelayObserver) {
  return new SmartPool({
    observe,
    websocketImplementation: FakeWebSocket as unknown as typeof WebSocket
  })
}

function getReqFilters(socket: FakeWebSocket) {
  const req = socket.sent.find((message) => message.startsWith('["REQ"'))
  return req ? JSON.parse(req).slice(2) : []
}

async function flushPromises() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

async function waitForReq(socket: FakeWebSocket) {
  await waitForReqCount(socket, 1)
}

async function waitForReqCount(socket: FakeWebSocket, count: number) {
  for (
    let i = 0;
    i < 10 && socket.sent.filter((message) => message.startsWith('["REQ"')).length < count;
    i++
  ) {
    await Promise.resolve()
  }
  expect(socket.sent.filter((message) => message.startsWith('["REQ"'))).toHaveLength(count)
}
