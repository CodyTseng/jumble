// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ZapDialog from './index'
import ZapButton from '../StuffStats/ZapButton'

const mocks = vi.hoisted(() => ({
  zap: vi.fn(),
  addZap: vi.fn(),
  toastError: vi.fn(),
  event: { id: 'note', pubkey: 'recipient' }
}))
vi.mock('@/services/lightning.service', () => ({ default: { zap: mocks.zap } }))
vi.mock('@/services/stuff-stats.service', () => ({ default: { addZap: mocks.addZap } }))
vi.mock('@/services/client.service', () => ({
  default: { fetchProfile: async () => ({ lightningAddress: 'recipient@example.com' }) }
}))
vi.mock('@/providers/NostrProvider', () => ({
  useNostr: () => ({ pubkey: 'sender', checkLogin: (callback: () => void) => callback() })
}))
vi.mock('@/providers/ZapProvider', () => ({
  useZap: () => ({ defaultZapSats: 21, defaultZapComment: '', quickZap: true })
}))
vi.mock('@/hooks/useStuff', () => ({
  useStuff: () => ({ event: mocks.event, stuffKey: 'note' })
}))
vi.mock('@/hooks/useStuffStatsById', () => ({ useStuffStatsById: () => ({}) }))
vi.mock('@/lib/event', () => ({ getEventAuthorPubkey: () => 'recipient' }))
vi.mock('@/lib/lightning', () => ({
  getLightningAddressFromProfile: () => 'recipient@example.com'
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))
vi.mock('../UserAvatar', () => ({ default: () => null }))
vi.mock('../Username', () => ({ default: () => null }))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? createElement('div', null, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => createElement('div', null, children)
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderDialog() {
  const setOpen = vi.fn()
  await act(async () => {
    root.render(createElement(ZapDialog, { open: true, setOpen, pubkey: 'recipient' }))
  })
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Zap n sats')
  )!
}

it('allows only one payment during rapid clicks, including clicks before the next render', async () => {
  let resolve!: (result: { invoice: string; preimage: string }) => void
  mocks.zap.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  const button = await renderDialog()
  await act(async () => {
    button.click()
    button.click()
  })
  expect(mocks.zap).toHaveBeenCalledExactlyOnceWith(
    'sender',
    'recipient',
    21,
    '',
    expect.any(Function)
  )
  expect(button.disabled).toBe(true)
  await act(async () => button.click())
  expect(mocks.zap).toHaveBeenCalledOnce()
  await act(async () => resolve({ invoice: 'invoice', preimage: 'preimage' }))
  expect(button.disabled).toBe(false)
})

it.each(['cancelled', 'failed'])('allows a retry after a %s payment', async (outcome) => {
  if (outcome === 'failed') mocks.zap.mockRejectedValueOnce(new Error('Payment failed'))
  else mocks.zap.mockResolvedValueOnce(null)
  mocks.zap.mockResolvedValueOnce({ invoice: 'invoice', preimage: 'preimage' })
  const button = await renderDialog()
  await act(async () => button.click())
  expect(button.disabled).toBe(false)
  expect(mocks.toastError).toHaveBeenCalledTimes(outcome === 'failed' ? 1 : 0)
  await act(async () => button.click())
  expect(mocks.zap).toHaveBeenCalledTimes(2)
})

it('also guards quick zaps against multiple events before React updates the button', async () => {
  let resolve!: (result: { invoice: string; preimage: string }) => void
  mocks.zap.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  await act(async () => root.render(createElement(ZapButton, { stuff: 'note' })))
  const button = container.querySelector('button')!
  expect(button.disabled).toBe(false)
  await act(async () => {
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
  })
  expect(mocks.zap).toHaveBeenCalledOnce()
  expect(button.disabled).toBe(true)
  await act(async () => resolve({ invoice: 'invoice', preimage: 'preimage' }))
  expect(mocks.addZap).toHaveBeenCalledExactlyOnceWith('sender', 'note', 'invoice', 21, '')
  expect(button.disabled).toBe(false)
})
