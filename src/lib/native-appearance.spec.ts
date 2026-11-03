import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { observeNativeKeyboard } from './native-appearance'

const native = vi.hoisted(() => ({
  android: true,
  addListener: vi.fn(),
  getKeyboardVisibility: vi.fn()
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => native }))
vi.mock('./platform', () => ({ isAndroid: () => native.android }))

beforeEach(() => {
  vi.resetAllMocks()
  native.android = true
})
afterEach(() => vi.restoreAllMocks())

it('observes an already visible keyboard and follows show/hide events', async () => {
  const remove = vi.fn(async () => {})
  native.addListener.mockResolvedValue({ remove })
  native.getKeyboardVisibility.mockResolvedValue({ visible: true })
  const changed = vi.fn()
  const stop = observeNativeKeyboard(changed)
  await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(true))
  const callback = native.addListener.mock.calls[0][1]
  callback({ visible: false })
  expect(changed).toHaveBeenLastCalledWith(false)
  stop()
  expect(remove).toHaveBeenCalledOnce()
  callback({ visible: true })
  expect(changed).toHaveBeenCalledTimes(2)
})

it('does not overwrite a newer keyboard event with an older initial snapshot', async () => {
  let resolveState!: (state: { visible: boolean }) => void
  native.addListener.mockResolvedValue({ remove: vi.fn() })
  native.getKeyboardVisibility.mockReturnValue(
    new Promise((resolve) => {
      resolveState = resolve
    })
  )
  const changed = vi.fn()
  const stop = observeNativeKeyboard(changed)
  await vi.waitFor(() => expect(native.getKeyboardVisibility).toHaveBeenCalledOnce())
  native.addListener.mock.calls[0][1]({ visible: true })
  resolveState({ visible: false })
  await Promise.resolve()
  expect(changed).toHaveBeenCalledExactlyOnceWith(true)
  stop()
})

it('removes a listener that finishes registering after unmount', async () => {
  let registered!: (handle: { remove: () => Promise<void> }) => void
  native.addListener.mockReturnValue(
    new Promise((resolve) => {
      registered = resolve
    })
  )
  const stop = observeNativeKeyboard(vi.fn())
  stop()
  const remove = vi.fn(async () => {})
  registered({ remove })
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce())
  expect(native.getKeyboardVisibility).not.toHaveBeenCalled()
})

it('leaves web and desktop behavior unchanged', () => {
  native.android = false
  const changed = vi.fn()
  observeNativeKeyboard(changed)()
  expect(native.addListener).not.toHaveBeenCalled()
  expect(changed).not.toHaveBeenCalled()
})
