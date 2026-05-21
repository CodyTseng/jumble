/**
 * Regression test for the ElectrumX bidirectional JSON-RPC bug.
 *
 * ElectrumX servers freely initiate their own JSON-RPC requests at the client
 * (server.banner, blockchain.headers.subscribe, blockchain.relayfee,
 * blockchain.estimatefee, …). These arrive interleaved with — and often
 * before — responses to outstanding client requests. The receive loop must
 * match `msg.id` against the call it is waiting on; otherwise the server
 * frame is consumed in place of the real response and the batch results are
 * corrupted (off-by-one or completely wrong).
 *
 * This test fakes a server that emits an unrelated
 * `blockchain.headers.subscribe` frame BEFORE the real response to id=1.
 * Without the id-matching guard, that frame is treated as the server.version
 * result and the subsequent id=1 response is consumed as id=2. With the
 * guard, the spurious frame is ignored and the batch resolves in order.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { wsRpcBatch } from './electrumx-ws'

type Listener = (ev: { data: string }) => void

describe('wsRpcBatch — bidirectional JSON-RPC id matching', () => {
  let originalWs: unknown

  beforeEach(() => {
    originalWs = (globalThis as { WebSocket?: unknown }).WebSocket
  })

  afterEach(() => {
    if (originalWs === undefined) {
      delete (globalThis as { WebSocket?: unknown }).WebSocket
    } else {
      ;(globalThis as { WebSocket?: unknown }).WebSocket = originalWs
    }
  })

  it('ignores server-initiated frames interleaved before the matching response', async () => {
    const messageListeners: Listener[] = []
    const openListeners: Array<() => void> = []

    function makeFakeWs(): unknown {
      const ws = {
        send: (raw: string) => {
          const req = JSON.parse(raw.trim()) as {
            method: string
            id: number
            params: unknown[]
          }

          // 1. Emit a server-initiated frame FIRST (no id, only method+params)
          //    — exactly what ElectrumX does for blockchain.headers.subscribe
          //    pushes, server.banner, blockchain.relayfee, etc.
          queueMicrotask(() => {
            for (const fn of messageListeners) {
              fn({
                data:
                  JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'blockchain.headers.subscribe',
                    params: [{ height: 999999, hex: 'deadbeef' }]
                  }) + '\n'
              })
            }
          })

          // 2. Then emit the genuine response with the matching id.
          queueMicrotask(() => {
            const result =
              req.method === 'server.version'
                ? ['ElectrumX 1.16.0', '1.4']
                : req.method === 'blockchain.scripthash.get_history'
                  ? [{ tx_hash: 'aabbcc', height: 42 }]
                  : null
            for (const fn of messageListeners) {
              fn({ data: JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n' })
            }
          })
        },
        close: () => {
          /* no-op */
        },
        addEventListener: (type: string, fn: Listener | (() => void)) => {
          if (type === 'message') messageListeners.push(fn as Listener)
          else if (type === 'open') openListeners.push(fn as () => void)
        }
      }
      // Fire open asynchronously, mimicking real WebSocket.
      queueMicrotask(() => {
        for (const fn of openListeners) fn()
      })
      return ws
    }

    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => makeFakeWs())

    const results = await wsRpcBatch('ws://fake.invalid', [
      { method: 'server.version', params: ['jumble/test', '1.4'] },
      { method: 'blockchain.scripthash.get_history', params: ['abc'] }
    ])

    // Without the id-matching fix, results[0] would be `undefined` (the
    // server-initiated frame has no `result` field), and results[1] would
    // be ['ElectrumX 1.16.0', '1.4'] (the real id=1 response, mis-attributed
    // to id=2). The genuine history response would never be observed.
    expect(results).toEqual([
      ['ElectrumX 1.16.0', '1.4'],
      [{ tx_hash: 'aabbcc', height: 42 }]
    ])
  })

  it('ignores server-initiated frames that arrive AFTER the matching response', async () => {
    // A second realistic shape: the matching response arrives first, then an
    // unrelated push arrives before the next request goes out. With the
    // guard this is a no-op; without it the push would be consumed as the
    // next response and corrupt the batch.
    const messageListeners: Listener[] = []
    const openListeners: Array<() => void> = []

    function makeFakeWs(): unknown {
      const ws = {
        send: (raw: string) => {
          const req = JSON.parse(raw.trim()) as {
            method: string
            id: number
          }
          // Real response first.
          queueMicrotask(() => {
            const result = req.method === 'server.version' ? ['EX', '1.4'] : []
            for (const fn of messageListeners) {
              fn({ data: JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n' })
            }
          })
          // Then an unrelated server push (no id) for the NEXT outstanding
          // call slot. With the bug this would slot in as the next response.
          queueMicrotask(() => {
            for (const fn of messageListeners) {
              fn({
                data:
                  JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'blockchain.relayfee',
                    params: [0.00001]
                  }) + '\n'
              })
            }
          })
        },
        close: () => undefined,
        addEventListener: (type: string, fn: Listener | (() => void)) => {
          if (type === 'message') messageListeners.push(fn as Listener)
          else if (type === 'open') openListeners.push(fn as () => void)
        }
      }
      queueMicrotask(() => {
        for (const fn of openListeners) fn()
      })
      return ws
    }

    ;(globalThis as { WebSocket?: unknown }).WebSocket = vi.fn(() => makeFakeWs())

    const results = await wsRpcBatch('ws://fake.invalid', [
      { method: 'server.version', params: [] },
      { method: 'blockchain.scripthash.get_history', params: ['x'] }
    ])

    expect(results).toEqual([['EX', '1.4'], []])
  })
})
