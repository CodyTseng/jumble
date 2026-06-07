/**
 * Tests for the multiplexed ElectrumX WebSocket client.
 *
 * Covers two things:
 *
 * 1. Bidirectional JSON-RPC: ElectrumX servers freely initiate their own
 *    requests at the client (server.banner, blockchain.headers.subscribe,
 *    blockchain.relayfee, blockchain.estimatefee, …). These arrive
 *    interleaved with — and often before — responses to outstanding client
 *    requests. The dispatcher must match `msg.id` against the call it is
 *    waiting on; otherwise the server frame is consumed in place of the
 *    real response and the batch results are corrupted.
 *
 * 2. Connection reuse: concurrent name lookups against the same server
 *    share one socket. The browser only sees one `new WebSocket(...)` per
 *    URL even when many lookups overlap, and the socket self-closes after
 *    a short idle window. This keeps Namecoin lookups well clear of the
 *    renderer-wide WebSocket cap that Jumble already brushes up against
 *    on browser builds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ElectrumxClient,
  closeAllElectrumxClients,
  getElectrumxClient,
  wsRpcBatch
} from './electrumx-ws'

type Listener = (ev: { data: string }) => void
type CloseListener = (ev: { code: number }) => void

interface FakeWs {
  send: (raw: string) => void
  close: () => void
  addEventListener: (type: string, fn: Listener | (() => void) | CloseListener) => void
}

interface FakeWsHandle {
  ws: FakeWs
  emit: (msg: Record<string, unknown>) => void
  emitRaw: (raw: string) => void
  triggerClose: (code?: number) => void
  sentMessages: Array<{ method: string; id: number; params: unknown[] }>
}

/**
 * Build a fake WebSocket that records sent messages and lets the test
 * push frames into the client at will. Mirrors the bits of the real
 * WebSocket API the client uses (addEventListener('open' | 'message' |
 * 'error' | 'close'), send, close).
 */
function makeFakeWs(opts?: { autoOpen?: boolean }): FakeWsHandle {
  const messageListeners: Listener[] = []
  const openListeners: Array<() => void> = []
  const closeListeners: CloseListener[] = []
  const sentMessages: FakeWsHandle['sentMessages'] = []
  let closed = false

  const ws: FakeWs = {
    send: (raw: string) => {
      const req = JSON.parse(raw.trim()) as { method: string; id: number; params: unknown[] }
      sentMessages.push(req)
    },
    close: () => {
      if (closed) return
      closed = true
      queueMicrotask(() => {
        for (const fn of closeListeners) fn({ code: 1000 })
      })
    },
    addEventListener: (type, fn) => {
      if (type === 'message') messageListeners.push(fn as Listener)
      else if (type === 'open') openListeners.push(fn as () => void)
      else if (type === 'close') closeListeners.push(fn as CloseListener)
    }
  }

  if (opts?.autoOpen !== false) {
    queueMicrotask(() => {
      for (const fn of openListeners) fn()
    })
  }

  return {
    ws,
    emit: (msg) => {
      for (const fn of messageListeners) {
        fn({ data: JSON.stringify(msg) + '\n' })
      }
    },
    emitRaw: (raw) => {
      for (const fn of messageListeners) {
        fn({ data: raw })
      }
    },
    triggerClose: (code = 1000) => {
      if (closed) return
      closed = true
      for (const fn of closeListeners) fn({ code })
    },
    sentMessages
  }
}

describe('ElectrumX WebSocket dispatch', () => {
  let originalWs: unknown

  beforeEach(() => {
    originalWs = (globalThis as { WebSocket?: unknown }).WebSocket
    closeAllElectrumxClients('test reset')
  })

  afterEach(() => {
    closeAllElectrumxClients('test teardown')
    if (originalWs === undefined) {
      delete (globalThis as { WebSocket?: unknown }).WebSocket
    } else {
      ;(globalThis as { WebSocket?: unknown }).WebSocket = originalWs
    }
  })

  // ── Bidirectional JSON-RPC id matching ─────────────────────────────

  it('ignores server-initiated frames interleaved before the matching response', async () => {
    const handle = makeFakeWs()
    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => handle.ws)

    const client = new ElectrumxClient('ws://fake.invalid')
    const pending = Promise.all([
      client.call('server.version', ['jumble/test', '1.4']),
      client.call('blockchain.scripthash.get_history', ['abc'])
    ])

    // Wait for both sends to be observed.
    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(2))

    // Server pushes a banner-style frame BEFORE either real response.
    handle.emit({
      jsonrpc: '2.0',
      method: 'blockchain.headers.subscribe',
      params: [{ height: 999999, hex: 'deadbeef' }]
    })
    // Then real responses, in REVERSE order of issuance — the multiplexer
    // must still dispatch each to the correct caller by id.
    const [versionReq, historyReq] = handle.sentMessages
    handle.emit({ jsonrpc: '2.0', id: historyReq.id, result: [{ tx_hash: 'aabbcc', height: 42 }] })
    handle.emit({ jsonrpc: '2.0', id: versionReq.id, result: ['ElectrumX 1.16.0', '1.4'] })

    const [version, history] = await pending
    expect(version).toEqual(['ElectrumX 1.16.0', '1.4'])
    expect(history).toEqual([{ tx_hash: 'aabbcc', height: 42 }])
  })

  it('ignores server-initiated frames that arrive AFTER the matching response', async () => {
    const handle = makeFakeWs()
    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => handle.ws)

    const client = new ElectrumxClient('ws://fake.invalid')
    const first = client.call('server.version', [])
    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(1))
    handle.emit({ jsonrpc: '2.0', id: handle.sentMessages[0].id, result: ['EX', '1.4'] })
    expect(await first).toEqual(['EX', '1.4'])

    // Server pushes an unrelated event with no matching id; must be ignored,
    // not consumed as the next call's result.
    handle.emit({ jsonrpc: '2.0', method: 'blockchain.relayfee', params: [0.00001] })

    const second = client.call('blockchain.scripthash.get_history', ['x'])
    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(2))
    handle.emit({ jsonrpc: '2.0', id: handle.sentMessages[1].id, result: [] })
    expect(await second).toEqual([])
  })

  it('handles multiple newline-delimited messages packed into one frame', async () => {
    const handle = makeFakeWs()
    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => handle.ws)

    const client = new ElectrumxClient('ws://fake.invalid')
    const pending = Promise.all([
      client.call('server.version', []),
      client.call('blockchain.scripthash.get_history', ['x'])
    ])
    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(2))

    const [a, b] = handle.sentMessages
    handle.emitRaw(
      JSON.stringify({ jsonrpc: '2.0', id: a.id, result: ['EX', '1.4'] }) +
        '\n' +
        JSON.stringify({ jsonrpc: '2.0', id: b.id, result: [{ tx_hash: 'aa', height: 1 }] }) +
        '\n'
    )

    expect(await pending).toEqual([['EX', '1.4'], [{ tx_hash: 'aa', height: 1 }]])
  })

  // ── Connection reuse / multiplexing ────────────────────────────────

  it('multiplexes concurrent calls over a single WebSocket', async () => {
    const handle = makeFakeWs()
    const wsCtor = vi.fn(() => handle.ws)
    ;(globalThis as { WebSocket?: unknown }).WebSocket = wsCtor

    const client = new ElectrumxClient('ws://fake.invalid')
    const calls = [
      client.call('blockchain.scripthash.get_history', ['s1']),
      client.call('blockchain.scripthash.get_history', ['s2']),
      client.call('blockchain.scripthash.get_history', ['s3']),
      client.call('blockchain.scripthash.get_history', ['s4'])
    ]

    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(4))

    // Only one socket was constructed even though four calls were in flight.
    expect(wsCtor).toHaveBeenCalledTimes(1)

    // Respond to all four in arbitrary order; each caller must receive its
    // own answer.
    for (const req of [...handle.sentMessages].reverse()) {
      handle.emit({ jsonrpc: '2.0', id: req.id, result: [`hist-${req.params[0]}`] })
    }
    expect(await Promise.all(calls)).toEqual([['hist-s1'], ['hist-s2'], ['hist-s3'], ['hist-s4']])
  })

  it('pool returns the same client instance for the same URL', () => {
    const handle = makeFakeWs()
    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => handle.ws)

    const a = getElectrumxClient('ws://fake.invalid')
    const b = getElectrumxClient('ws://fake.invalid')
    expect(a).toBe(b)
  })

  it('wsRpcBatch shim shares the pooled client across overlapping batches', async () => {
    const handle = makeFakeWs()
    const wsCtor = vi.fn(() => handle.ws)
    ;(globalThis as { WebSocket?: unknown }).WebSocket = wsCtor

    const p1 = wsRpcBatch('ws://fake.invalid', [
      { method: 'server.version', params: [] },
      { method: 'blockchain.scripthash.get_history', params: ['s1'] }
    ])
    const p2 = wsRpcBatch('ws://fake.invalid', [
      { method: 'blockchain.scripthash.get_history', params: ['s2'] }
    ])

    // Three RPCs total, one socket.
    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(3))
    expect(wsCtor).toHaveBeenCalledTimes(1)

    for (const req of handle.sentMessages) {
      const reply =
        req.method === 'server.version' ? ['EX', '1.4'] : [`hist-${(req.params as string[])[0]}`]
      handle.emit({ jsonrpc: '2.0', id: req.id, result: reply })
    }

    expect(await p1).toEqual([['EX', '1.4'], ['hist-s1']])
    expect(await p2).toEqual([['hist-s2']])
  })

  it('rejects all in-flight calls when the socket closes mid-flight', async () => {
    const handle = makeFakeWs()
    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => handle.ws)

    const client = new ElectrumxClient('ws://fake.invalid')
    const calls = [
      client.call('blockchain.scripthash.get_history', ['s1']),
      client.call('blockchain.scripthash.get_history', ['s2'])
    ]
    await vi.waitFor(() => expect(handle.sentMessages.length).toBe(2))

    handle.triggerClose(1006)

    await expect(calls[0]).rejects.toThrow(/closed/i)
    await expect(calls[1]).rejects.toThrow(/closed/i)
  })

  it('rejects in-flight callers when ensureOpen fails', async () => {
    // WebSocket constructor throws synchronously — exercises the
    // bailOnOpenFailure path.
    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => {
      throw new Error('boom')
    })

    const client = new ElectrumxClient('ws://fake.invalid')
    await expect(client.call('server.version', [])).rejects.toThrow()
  })
})
