import { describe, expect, it, vi } from 'vitest'

import { trackZapStatus } from '@/lib/zap-status-toast'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    promise: vi.fn((promise: Promise<unknown>) => ({
      unwrap: () => promise
    }))
  }
}))

const messages = {
  loading: 'Zapping...',
  success: 'Zap sent!',
  canceled: 'Zap canceled',
  error: (error: unknown) => `Zap failed: ${(error as Error).message}`
}

describe('trackZapStatus', () => {
  it('keeps zap progress in a global toast and resolves with the zap result', async () => {
    const zapResult = { preimage: 'preimage', invoice: 'invoice' }
    const promise = Promise.resolve(zapResult)

    await expect(trackZapStatus(promise, messages)).resolves.toEqual(zapResult)

    expect(toast.promise).toHaveBeenCalledWith(
      promise,
      expect.objectContaining({
        loading: messages.loading,
        success: expect.any(Function),
        error: messages.error
      })
    )

    const toastOptions = vi.mocked(toast.promise).mock.calls[0][1]
    const success = toastOptions?.success
    expect(success).toEqual(expect.any(Function))
    if (typeof success !== 'function') {
      throw new Error('Expected zap status toast success handler to be a function')
    }
    expect(success(zapResult)).toBe(messages.success)
    expect(success(null)).toBe(messages.canceled)
  })
})
