import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeRelayPoolLifecycle } from './relay-pool-lifecycle'

describe('observeRelayPoolLifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('propagates network state and checks relays after coming online', async () => {
    const listeners = installPageGlobals(false)
    const calls: string[] = []
    const target = {
      setNetworkOnline: vi.fn(async (online: boolean) => {
        calls.push(`online:${online}`)
      }),
      checkRelays: vi.fn(async () => {
        calls.push('check')
      })
    }

    observeRelayPoolLifecycle(target)
    await flushPromises()
    expect(calls).toEqual(['online:false'])

    listeners.get('online')?.()
    await flushPromises()
    expect(calls).toEqual(['online:false', 'online:true', 'check'])

    listeners.get('offline')?.()
    await flushPromises()
    expect(calls.at(-1)).toBe('online:false')
  })

  it('checks relays only when a hidden page becomes visible', async () => {
    const listeners = installPageGlobals(true)
    const document = globalThis.document as unknown as { visibilityState: string }
    const target = {
      setNetworkOnline: vi.fn(),
      checkRelays: vi.fn(async () => undefined)
    }
    observeRelayPoolLifecycle(target)

    listeners.get('visibilitychange')?.()
    await flushPromises()
    expect(target.checkRelays).not.toHaveBeenCalled()

    document.visibilityState = 'visible'
    listeners.get('visibilitychange')?.()
    await flushPromises()
    expect(target.checkRelays).toHaveBeenCalledOnce()
  })

  it('checks relays on Page Lifecycle resume', async () => {
    const listeners = installPageGlobals(true)
    const target = {
      setNetworkOnline: vi.fn(),
      checkRelays: vi.fn(async () => undefined)
    }
    observeRelayPoolLifecycle(target)

    listeners.get('resume')?.()
    await flushPromises()
    expect(target.checkRelays).toHaveBeenCalledOnce()
  })

  it('checks relays on bfcache pageshow', async () => {
    const listeners = installPageGlobals(true)
    const target = {
      setNetworkOnline: vi.fn(),
      checkRelays: vi.fn(async () => undefined)
    }
    observeRelayPoolLifecycle(target)

    const pageshow = listeners.get('pageshow') as unknown as (event: { persisted: boolean }) => void
    pageshow({ persisted: true })
    await flushPromises()
    expect(target.checkRelays).toHaveBeenCalledOnce()
  })
})

function installPageGlobals(online: boolean) {
  const listeners = new Map<string, () => void>()
  const addEventListener = (type: string, listener: (event?: unknown) => void) =>
    listeners.set(type, listener as () => void)
  vi.stubGlobal('navigator', { onLine: online })
  vi.stubGlobal('addEventListener', addEventListener)
  vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener })
  // document + window share the same listener map in these stubs
  return listeners
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
