import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  electron: false,
  web: 0,
  desktop: 0,
  ensure: vi.fn(),
  close: vi.fn(),
  publish: vi.fn(async () => {}),
  subscribe: vi.fn()
}))
vi.mock('@/lib/platform', () => ({
  isElectron: () => state.electron,
  getElectronBridge: () => ({})
}))
vi.mock('@/lib/smart-pool', () => ({
  SmartPool: class {
    constructor() {
      state.web++
    }
    ensureRelay = state.ensure
  }
}))
vi.mock('@/lib/electron-pool', () => ({
  ElectronPool: class {
    constructor() {
      state.desktop++
    }
    ensureRelay = state.ensure
  }
}))
beforeEach(() => {
  vi.resetModules()
  state.electron = false
  state.web = state.desktop = 0
  state.close.mockClear()
  state.publish.mockClear()
  state.subscribe.mockReset().mockReturnValue({ close: state.close })
  state.ensure.mockReset().mockResolvedValue({ subscribe: state.subscribe, publish: state.publish })
})
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

it('routes Electron requests through the main-process bridge and releases only its subscription', async () => {
  state.electron = true
  const { RelayPool } = await import('./relay')
  const pool = new RelayPool()
  pool.req(['wss://relay.example'], [{ kinds: [1] }]).subscribe()
  await tick()
  expect(state.desktop).toBe(1)
  expect(state.web).toBe(0)
  expect(state.subscribe).toHaveBeenCalledOnce()
  pool.close()
  expect(state.close).toHaveBeenCalledOnce()
})

it('a connection completing after retirement cannot subscribe or broadcast', async () => {
  let finish!: (relay: unknown) => void
  state.ensure.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const { RelayPool } = await import('./relay')
  const pool = new RelayPool()
  pool.req(['wss://relay.example'], [{}]).subscribe()
  pool.close()
  finish({ subscribe: state.subscribe, publish: state.publish })
  await tick()
  expect(state.subscribe).not.toHaveBeenCalled()
  const closed = new RelayPool()
  const event = closed
    .relay('wss://relay.example')
    .event({} as never)
    .subscribe({ error() {} })
  closed.close()
  finish({ subscribe: state.subscribe, publish: state.publish })
  await tick()
  expect(state.publish).not.toHaveBeenCalled()
  event.unsubscribe()
})
