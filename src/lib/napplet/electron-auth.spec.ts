import { beforeEach, expect, it, vi } from 'vitest'
import { ElectronPool } from '@/lib/electron-pool'

const state = vi.hoisted(() => ({
  onAuthRequest: vi.fn((_handler: (request: unknown) => Promise<void>) => () => {}),
  sendAuthResponse: vi.fn()
}))
vi.mock('@/lib/platform', () => ({
  getElectronBridge: () => ({
    relay: {
      onObservation: () => () => {},
      onSubEvent: () => () => {},
      onSubEose: () => () => {},
      onSubClose: () => () => {},
      onAuthRequest: state.onAuthRequest,
      sendAuthResponse: state.sendAuthResponse
    }
  })
}))
vi.mock('@/services/relay-observation.service', () => ({ default: {} }))
vi.mock('@/lib/relay-pool-lifecycle', () => ({ observeRelayPoolLifecycle: () => {} }))
beforeEach(() => vi.clearAllMocks())

it('a signer-free napplet pool cannot race the application AUTH responder', async () => {
  new ElectronPool(() => undefined)
  new ElectronPool(() => undefined, { handleAuthRequests: false })
  expect(state.onAuthRequest).toHaveBeenCalledOnce()
  const handler = state.onAuthRequest.mock.calls[0][0]
  await handler({ requestId: 'auth', authEvent: {} })
  expect(state.sendAuthResponse).toHaveBeenCalledExactlyOnceWith({
    requestId: 'auth',
    error: 'not logged in'
  })
})
