import type { Event as NEvent, Filter } from 'nostr-tools'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IRelay, TSubHandlers } from '@/types/relay-pool'
import type { RelayObserver } from './relay-observation'
import type { TElectronBridge, TElectronRelayBridge } from '../../electron/shared/ipc-types'
import { IPC_CHANNELS } from '../../electron/shared/ipc-types'

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  getBridge: vi.fn(),
  physicalRelays: new Map<string, IRelay>(),
  observe: undefined as RelayObserver | undefined
}))
vi.mock('electron', () => ({ app: { getVersion: () => 'test' } }))
vi.mock('./platform', () => ({ getElectronBridge: mocks.getBridge }))
vi.mock('./relay-pool-lifecycle', () => ({ observeRelayPoolLifecycle: () => {} }))
vi.mock('@/services/relay-observation.service', () => ({ default: { record: mocks.record } }))
vi.mock('./smart-pool', () => ({
  SmartPool: class {
    constructor(options: { observe?: RelayObserver }) {
      mocks.observe = options.observe
    }
    getRelay(url: string) {
      return mocks.physicalRelays.get(url)!
    }
  }
}))

import { RelayManager } from '../../electron/main/relay-manager'
import { ElectronPool } from './electron-pool'
import { subscribeRelays } from './relay-subscription'
import { publishRelayEvent } from './relay-publication'

const url = 'wss://relay.example/'
const event = { id: 'a'.repeat(64) } as NEvent

function setup() {
  const callbacks = new Map<string, (payload: never) => void>()
  const manager = new RelayManager()
  manager.attachWindow({
    isDestroyed: () => false,
    webContents: { send: (channel: string, payload: never) => callbacks.get(channel)?.(payload) }
  } as unknown as BrowserWindow)
  const listen = (channel: string) => (callback: (payload: never) => void) => {
    callbacks.set(channel, callback)
    return () => {
      callbacks.delete(channel)
    }
  }
  const relayBridge = {
    onObservation: listen(IPC_CHANNELS.observation),
    onSubEvent: listen(IPC_CHANNELS.subEvent),
    onSubEose: listen(IPC_CHANNELS.subEose),
    onSubClose: listen(IPC_CHANNELS.subClose),
    onAuthRequest: listen(IPC_CHANNELS.authRequest),
    subscribe: async (id: string, relayUrl: string, filters: Filter[]) =>
      manager.subscribe(id, relayUrl, filters),
    closeSub: async (id: string) => manager.closeSub(id),
    auth: async (relayUrl: string) => manager.auth(relayUrl),
    publish: async (relayUrl: string, evt: NEvent, timeout: number, id?: string) => {
      try {
        await manager.publish(relayUrl, evt, timeout, id)
      } catch (error) {
        throw new Error(
          `Error invoking remote method 'relay:publish': Error: ${(error as Error).message}`
        )
      }
    }
  } as unknown as TElectronRelayBridge
  mocks.getBridge.mockReturnValue({ relay: relayBridge } as TElectronBridge)
  return { manager, pool: new ElectronPool(() => undefined) }
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.record.mockReset()
  mocks.physicalRelays.clear()
})
afterEach(() => vi.useRealTimers())

describe('Electron relay observation transport', () => {
  it('transports first matching data and deduplicates it before application delivery', async () => {
    let handlers!: TSubHandlers
    mocks.physicalRelays.set(url, {
      url,
      publishTimeout: 10000,
      publish: async () => {},
      auth: async () => {},
      subscribe: (_filters, value) => {
        handlers = value
        return { close: () => {} }
      }
    })
    const { pool } = setup()
    const observe = vi.fn()
    const onevent = vi.fn()
    subscribeRelays(pool, [url], [{}], { observe, onevent, alreadyHaveEvent: () => true })
    await Promise.resolve()
    await Promise.resolve()
    handlers.onrequest?.(Date.now())
    await vi.advanceTimersByTimeAsync(120)
    handlers.ondata?.(Date.now())
    handlers.ondata?.(Date.now())
    handlers.onevent?.(event)
    handlers.oneose?.()
    await vi.advanceTimersByTimeAsync(10000)
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'read-time', duration: 120 })
    )
    expect(onevent).not.toHaveBeenCalled()
  })

  it('preserves auth-required across IPC errors and records one successful logical write', async () => {
    let attempts = 0
    mocks.physicalRelays.set(url, {
      url,
      publishTimeout: 10000,
      auth: vi.fn(async () => {}),
      subscribe: () => ({ close: () => {} }),
      publish: async (_event, onstart) => {
        onstart?.(Date.now())
        await new Promise((resolve) => setTimeout(resolve, 100))
        if (++attempts === 1) throw new Error('auth-required: please auth')
      }
    })
    const { pool } = setup()
    const relay = await pool.ensureRelay(url)
    const observe = vi.fn()
    const promise = publishRelayEvent(relay, event, observe, () =>
      relay.auth(async () => event as never).then(() => undefined)
    )
    await vi.advanceTimersByTimeAsync(200)
    await promise
    expect(attempts).toBe(2)
    expect(mocks.physicalRelays.get(url)!.auth).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'write-time', duration: 200 })
    )
  })

  it('forwards main-process connection observations into renderer storage', () => {
    setup()
    const observation = { type: 'connection' as const, url, at: Date.now(), duration: 150 }
    mocks.observe?.(observation)
    expect(mocks.record).toHaveBeenCalledWith(observation)
  })
})
