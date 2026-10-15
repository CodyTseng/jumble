import { runInNewContext } from 'node:vm'
import shim from '@napplet/shim/prelude.global?raw'
import { afterEach, expect, it, vi } from 'vitest'
import { nappletPrelude } from './vendor/runtime/src/prelude'

afterEach(() => vi.useRealTimers())

it('the iframe OUTBOX request survives a full 30-second approval before the shell replies', async () => {
  vi.useFakeTimers()
  const messages: Record<string, unknown>[] = []
  const listeners = new Set<(event: unknown) => void>()
  const parent = { postMessage: (message: Record<string, unknown>) => messages.push(message) }
  const context = {
    parent,
    crypto,
    TextEncoder,
    TextDecoder,
    URL,
    Blob,
    document: { addEventListener() {}, removeEventListener() {} },
    structuredClone,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    addEventListener: (_type: string, listener: (event: unknown) => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: unknown) => void) =>
      listeners.delete(listener)
  }
  const realm = { ...context, window: context } as typeof context & {
    window: typeof context & {
      napplet?: { outbox: { publish: (event: unknown) => Promise<unknown> } }
    }
  }
  runInNewContext(nappletPrelude(shim), realm)
  const result = realm.window.napplet!.outbox.publish({
    kind: 1,
    content: 'approved',
    tags: [],
    created_at: 1
  })
  let outcome: unknown = 'pending'
  void result.then(
    (value) => {
      outcome = value
    },
    (error) => {
      outcome = error
    }
  )
  await vi.advanceTimersByTimeAsync(31_000)
  expect(outcome).toBe('pending')
  const request = messages.find((message) => message.type === 'outbox.publish')!
  const response = {
    source: parent,
    data: { type: 'outbox.publish.result', id: request.id, ok: true, eventId: 'signed' }
  }
  listeners.forEach((listener) => listener(response))
  await expect(result).resolves.toMatchObject({ ok: true, eventId: 'signed' })
})
