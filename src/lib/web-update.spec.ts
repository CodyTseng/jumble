// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchWebUpdate } from './web-update'

class Worker extends EventTarget {
  state: ServiceWorkerState = 'installing'
  postMessage = vi.fn()
  change(state: ServiceWorkerState) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

function setup({ firstInstall = false, waiting = false } = {}) {
  const worker = new Worker()
  if (waiting) worker.state = 'installed'
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? worker : null,
    installing: waiting ? null : worker,
    update: vi.fn().mockResolvedValue(undefined)
  })
  const register = vi.fn().mockResolvedValue(registration)
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: firstInstall ? null : {},
    register
  })
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true })
  const ready = vi.fn()
  const error = vi.fn()
  const reload = vi.fn()
  const watcher = watchWebUpdate(ready, error, reload)
  return { worker, registration, serviceWorker, register, ready, error, reload, watcher }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('web update registration', () => {
  it('does not announce the initial installation', async () => {
    const { worker, ready, watcher } = setup({ firstInstall: true })
    await Promise.resolve()
    worker.change('installed')
    expect(ready).not.toHaveBeenCalled()
    watcher.dispose()
  })

  it('offers an already waiting update without activating it', async () => {
    const { worker, ready, register, watcher } = setup({ waiting: true })
    await Promise.resolve()
    expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
    expect(ready).toHaveBeenCalledOnce()
    expect(worker.postMessage).not.toHaveBeenCalled()
    watcher.dispose()
  })

  it('offers a new update only after installation finishes', async () => {
    const { worker, ready, watcher } = setup()
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    worker.change('installed')
    expect(ready).toHaveBeenCalledOnce()
    expect(worker.postMessage).not.toHaveBeenCalled()
    watcher.dispose()
  })

  it('does not reload or activate in response to another tab changing controllers', async () => {
    const { worker, serviceWorker, watcher } = setup({ waiting: true })
    await Promise.resolve()
    const listener = vi.spyOn(serviceWorker, 'addEventListener')
    serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    watcher.dispose()
  })

  it('activates only on apply and rejects a timeout so the user can retry', async () => {
    const { worker, watcher } = setup({ waiting: true })
    await Promise.resolve()
    const applying = watcher.apply()
    const rejected = expect(applying).rejects.toThrow('Update timed out')
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    await vi.advanceTimersByTimeAsync(15000)
    await rejected
    watcher.dispose()
  })

  it('reloads the accepting tab only after activation', async () => {
    const { worker, watcher, reload } = setup({ waiting: true })
    await Promise.resolve()
    const applying = watcher.apply()
    expect(reload).not.toHaveBeenCalled()
    worker.change('activated')
    await applying
    expect(reload).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    watcher.dispose()
  })

  it('can reload explicitly after another tab already activated the worker', async () => {
    const { registration, watcher, reload } = setup({ waiting: true })
    await Promise.resolve()
    registration.waiting = null
    expect(reload).not.toHaveBeenCalled()
    await watcher.apply()
    expect(reload).toHaveBeenCalledOnce()
    watcher.dispose()
  })

  it('cancels activation listeners and never reloads after disposal', async () => {
    const { worker, watcher, reload } = setup({ waiting: true })
    await Promise.resolve()
    const applying = watcher.apply()
    watcher.dispose()
    worker.change('activated')
    await applying
    expect(reload).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes listeners when unmounted and ignores late registration', async () => {
    const { worker, ready, watcher } = setup()
    watcher.dispose()
    await Promise.resolve()
    worker.change('installed')
    expect(ready).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('checks hourly while visible and online, not on every focus', async () => {
    const { registration, watcher } = setup()
    await Promise.resolve()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledOnce()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledOnce()
    watcher.dispose()
  })
})
