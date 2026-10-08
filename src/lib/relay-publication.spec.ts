import type { Event as NEvent } from 'nostr-tools'
import type { IRelay } from '@/types/relay-pool'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishRelayEvent } from './relay-publication'

const event = { id: 'a'.repeat(64) } as NEvent
function relayWithResults(results: (Error | undefined)[]) {
  let attempts = 0
  const relay: IRelay = {
    url: 'wss://relay.example/',
    publishTimeout: 10000,
    auth: async () => {},
    subscribe: () => ({ close: () => {} }),
    publish: vi.fn(async (_event, onstart) => {
      onstart?.(Date.now())
      const result = results[attempts++]
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (result) throw result
    })
  }
  return relay
}

describe('publish observations', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it.each([
    'auth-required: please auth',
    'ERROR: auth-required: please auth',
    'publish rejected (AUTH-REQUIRED)'
  ])(
    'includes authentication waiting for %s in one successful write, without a refusal',
    async (reason) => {
      const relay = relayWithResults([new Error(reason), undefined])
      const observe = vi.fn()
      const authenticate = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      })
      const promise = publishRelayEvent(relay, event, observe, authenticate)
      await vi.advanceTimersByTimeAsync(400)
      await promise
      expect(relay.publish).toHaveBeenCalledTimes(2)
      expect(authenticate).toHaveBeenCalledOnce()
      expect(observe).toHaveBeenCalledOnce()
      expect(observe).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'write-time', duration: 400 })
      )
    }
  )

  it('counts only the final refusal after authentication', async () => {
    const relay = relayWithResults([
      new Error('auth-required'),
      new Error('restricted: members only')
    ])
    const observe = vi.fn()
    const promise = publishRelayEvent(relay, event, observe, async () => {})
    const rejection = expect(promise).rejects.toThrow('restricted')
    await vi.advanceTimersByTimeAsync(200)
    await rejection
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'write-rejection', reason: 'restricted: members only' })
    )
  })

  it('does not count missing authentication as refusal or timeout', async () => {
    const relay = relayWithResults([new Error('ERROR: auth-required: restricted')])
    const observe = vi.fn()
    const promise = publishRelayEvent(relay, event, observe)
    const rejection = expect(promise).rejects.toThrow('auth-required')
    await vi.advanceTimersByTimeAsync(100)
    await rejection
    expect(observe).not.toHaveBeenCalled()
  })

  it('propagates authentication failure without recording a relay issue', async () => {
    const relay = relayWithResults([new Error('auth-required')])
    const observe = vi.fn()
    const promise = publishRelayEvent(relay, event, observe, async () => {
      throw new Error('signing rejected')
    })
    const rejection = expect(promise).rejects.toThrow('signing rejected')
    await vi.advanceTimersByTimeAsync(100)
    await rejection
    expect(observe).not.toHaveBeenCalled()
    expect(relay.publish).toHaveBeenCalledOnce()
  })

  it('separates a write confirmation timeout from an explicit refusal', async () => {
    const relay = relayWithResults([new Error('publish timed out')])
    const observe = vi.fn()
    const promise = publishRelayEvent(relay, event, observe)
    const rejection = expect(promise).rejects.toThrow('publish timed out')
    await vi.advanceTimersByTimeAsync(100)
    await rejection
    expect(observe.mock.calls.map(([item]) => item.type)).toEqual(['write-timeout'])
  })

  it('does not report a connection failure as a write refusal', async () => {
    const relay = relayWithResults([])
    relay.publish = vi.fn(async () => {
      throw new Error('relay connection failed')
    })
    const observe = vi.fn()
    await expect(publishRelayEvent(relay, event, observe)).rejects.toThrow(
      'relay connection failed'
    )
    expect(observe).not.toHaveBeenCalled()
  })
})
