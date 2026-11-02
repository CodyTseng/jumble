// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from './download'
const harness = vi.hoisted(() => ({
  android: true,
  saveText: vi.fn(),
  loading: vi.fn(() => 1),
  success: vi.fn(),
  dismiss: vi.fn(),
  error: vi.fn()
}))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ saveText: harness.saveText }) }))
vi.mock('./platform', () => ({ isAndroid: () => harness.android }))
vi.mock('i18next', () => ({ t: (key: string) => key }))
vi.mock('sonner', () => ({ toast: harness }))
beforeEach(() => {
  vi.clearAllMocks()
  harness.android = true
  harness.saveText.mockResolvedValue({ saved: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('text file export', () => {
  it('reports success only when the native picker confirms the write', async () => {
    expect(await downloadTextFile('test.txt', 'test backup')).toBe(true)
    expect(harness.saveText).toHaveBeenCalledWith({ filename: 'test.txt', text: 'test backup' })
    expect(harness.success).toHaveBeenCalledWith('Saved', { id: 1 })
  })
  it('does not report a cancelled picker as saved', async () => {
    harness.saveText.mockResolvedValue({ saved: false })
    expect(await downloadTextFile('test.txt', 'test backup')).toBe(false)
    expect(harness.success).not.toHaveBeenCalled()
    expect(harness.dismiss).toHaveBeenCalledWith(1)
  })
  it('surfaces write failures without throwing an unhandled rejection', async () => {
    harness.saveText.mockRejectedValue(new Error('disk full'))
    expect(await downloadTextFile('test.txt', 'test backup')).toBe(false)
    expect(harness.error).toHaveBeenCalled()
    expect(harness.success).not.toHaveBeenCalled()
  })
  it('keeps the synchronous browser gesture on web', async () => {
    harness.android = false
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const result = downloadTextFile('test.txt', 'test backup')
    expect(click).toHaveBeenCalledOnce()
    expect(harness.saveText).not.toHaveBeenCalled()
    expect(await result).toBe(true)
  })
})
