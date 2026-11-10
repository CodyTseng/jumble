import { beforeEach, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ request: vi.fn(), android: true }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => native }))
vi.mock('./platform', () => ({ isAndroid: () => native.android }))
import { requestNativeSignature } from './native-signer'

beforeEach(() => {
  native.request.mockReset()
  native.android = true
})

it('serializes requests across accounts and releases the queue after rejection', async () => {
  let reject!: (error: Error) => void
  native.request.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail
      })
  )
  native.request.mockResolvedValueOnce({ result: 'second' })
  const first = requestNativeSignature({ type: 'get_public_key', payload: '' })
  const second = requestNativeSignature({ type: 'get_public_key', payload: '' })
  await vi.waitFor(() => expect(native.request).toHaveBeenCalledTimes(1))
  const failure = expect(first).rejects.toThrow('Cancelled')
  reject(new Error('Cancelled'))
  await failure
  await expect(second).resolves.toEqual({ result: 'second' })
  expect(native.request).toHaveBeenCalledTimes(2)
})

it('never invokes the native plugin from the web', async () => {
  native.android = false
  await expect(requestNativeSignature({ type: 'get_public_key', payload: '' })).rejects.toThrow(
    'Android app'
  )
  expect(native.request).not.toHaveBeenCalled()
})
