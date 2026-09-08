import { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toastPromise } from './toast'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => '关闭' })
}))

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback())
})

afterEach(() => {
  for (const item of toast.getToasts()) toast.dismiss(item.id)
  vi.unstubAllGlobals()
})

describe('toastPromise', () => {
  it('closes a loading toast without interrupting its promise or losing the result', async () => {
    let resolve!: (value: string) => void
    const promise = new Promise<string>((done) => {
      resolve = done
    })
    const onDismiss = vi.fn()
    const result = toastPromise(promise, {
      id: 'loading-success',
      loading: 'Sending...',
      success: (value) => `Sent ${value}`,
      onDismiss
    })
    const loadingToast = toast.getToasts().find((item) => item.id === 'loading-success')!
    expect(loadingToast).toMatchObject({ type: 'loading' })
    const content = (loadingToast as { title: ReactElement<{ onClose: () => void }> }).title
    const markup = renderToStaticMarkup(content)
    expect(markup).toContain('Sending...')
    expect(markup).toContain('data-close-button="true"')
    expect(markup).toContain('aria-label="关闭"')

    content.props.onClose()
    expect(toast.getToasts().some((item) => item.id === 'loading-success')).toBe(false)
    expect(onDismiss).toHaveBeenCalledWith(loadingToast)

    resolve('note')
    await expect(result.unwrap()).resolves.toBe('note')
    expect(toast.getToasts()).toContainEqual(
      expect.objectContaining({ id: 'loading-success', type: 'success', title: 'Sent note' })
    )
  })

  it('preserves rejection and error toast options after closing the loading toast', async () => {
    let reject!: (error: Error) => void
    const promise = new Promise<never>((_, fail) => {
      reject = fail
    })
    const result = toastPromise(promise, {
      id: 'loading-error',
      loading: 'Sending...',
      error: (error: Error) => ({ message: error.message, duration: Infinity })
    })
    const loadingToast = toast.getToasts().find((item) => item.id === 'loading-error')!
    const content = (loadingToast as { title: ReactElement<{ onClose: () => void }> }).title
    content.props.onClose()

    const error = new Error('Failed to send')
    reject(error)
    await expect(result.unwrap()).rejects.toBe(error)
    expect(toast.getToasts()).toContainEqual(
      expect.objectContaining({
        id: 'loading-error',
        type: 'error',
        title: error.message,
        duration: Infinity
      })
    )
  })

  it.each([{ closeButton: false }, { dismissible: false }])(
    'respects explicit dismissal options: %s',
    async (options) => {
      const result = toastPromise(Promise.resolve('done'), {
        ...options,
        id: 'non-dismissible',
        loading: 'Sending...',
        success: 'Sent'
      })
      expect(toast.getToasts()).toContainEqual(
        expect.objectContaining({ id: 'non-dismissible', title: 'Sending...' })
      )
      await expect(result.unwrap()).resolves.toBe('done')
    }
  )
})
