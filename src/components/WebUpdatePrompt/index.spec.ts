// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WebUpdatePrompt from './index'

const harness = vi.hoisted(() => ({
  electron: false,
  apply: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn(),
  ready: undefined as (() => void) | undefined,
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
  t: (key: string) => key
}))
vi.mock('@/lib/platform', () => ({ isElectron: () => harness.electron }))
vi.mock('@/lib/web-update', () => ({
  watchWebUpdate: vi.fn((ready: () => void) => {
    harness.ready = ready
    return { apply: harness.apply, dispose: harness.dispose }
  })
}))
vi.mock('sonner', () => ({ toast: harness.toast }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: harness.t }) }))

let root: Root
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('PROD', true)
  harness.electron = false
  harness.ready = undefined
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  root = createRoot(document.createElement('div'))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('web update prompt', () => {
  it('does not register a web updater in Electron', async () => {
    harness.electron = true
    await act(async () => root.render(createElement(WebUpdatePrompt)))
    expect(harness.ready).toBeUndefined()
  })

  it('shows a dismissible offer, but cancellation never activates the update', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await act(async () => root.render(createElement(WebUpdatePrompt)))
    harness.ready?.()
    const options = harness.toast.mock.calls[0][1]
    expect(options.duration).toBe(Infinity)
    const event = { preventDefault: vi.fn() }
    options.action.onClick(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(window.confirm).toHaveBeenCalledWith(
      'Save any unfinished work before reloading to update. Reload now?'
    )
    expect(harness.apply).not.toHaveBeenCalled()
    await vi.runOnlyPendingTimersAsync()
    expect(harness.toast).toHaveBeenCalledOnce()
  })

  it('only applies after confirmation and ignores double clicks', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => root.render(createElement(WebUpdatePrompt)))
    harness.ready?.()
    const click = harness.toast.mock.calls[0][1].action.onClick
    click({ preventDefault: vi.fn() })
    click({ preventDefault: vi.fn() })
    expect(harness.apply).toHaveBeenCalledOnce()
  })
})
