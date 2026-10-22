// @vitest-environment jsdom

import ClientSelect from '@/components/ClientSelect'
import SaveRelayDropdownMenu from '@/components/SaveRelayDropdownMenu'
import { nip19 } from 'nostr-tools'
import ClickableCard from '@/components/ClickableCard'
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import type { Event as NostrEvent } from 'nostr-tools'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NoteOptions from './index'

vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: true })
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/client.service', () => ({ default: {} }))
vi.mock('@/providers/NostrProvider', () => ({ useNostr: () => ({ pubkey: 'self' }) }))
vi.mock('@/providers/FavoriteRelaysProvider', () => ({
  useFavoriteRelays: () => ({ favoriteRelays: [], relaySets: [] })
}))
vi.mock('./useMenuActions', () => ({ useMenuActions: () => [] }))
vi.mock('./DesktopMenu', () => ({ DesktopMenu: () => null }))
vi.mock('./RawEventDialog', () => ({ default: () => null }))
vi.mock('./ReportDialog', () => ({ default: () => null }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe.each([
  ['note options', () => createElement(NoteOptions, { event: {} as NostrEvent })],
  [
    'client selector',
    () => createElement(ClientSelect, { originalNoteId: nip19.noteEncode('1'.repeat(64)) })
  ],
  ['save relay menu', () => createElement(SaveRelayDropdownMenu, { urls: ['wss://relay.example'] })]
] as const)('%s outside dismissal', (_name, entry) => {
  it.each(['touch', 'mouse'])(
    'closes on an outside %s without opening the underlying note',
    async (pointerType) => {
      const navigate = vi.fn()
      await act(async () =>
        root.render(createElement(ClickableCard, { onClick: navigate }, entry()))
      )
      await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
      const surface = document.querySelector('[role="dialog"]')!
      expect(surface).not.toBeNull()
      const backdrop = surface.previousElementSibling!
      expect(backdrop.className).toContain('bg-black/80')
      // Radix registers its document pointer listener on the next event-loop turn.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      await act(async () => {
        const insidePointer = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
        Object.defineProperty(insidePointer, 'pointerType', { value: pointerType })
        surface.dispatchEvent(insidePointer)
        surface.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(document.querySelector('[role="dialog"]')).toBe(surface)
      expect(navigate).not.toHaveBeenCalled()
      await act(async () => {
        const pointer = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
        Object.defineProperty(pointer, 'pointerType', { value: pointerType })
        backdrop.dispatchEvent(pointer)
      })
      await act(async () => backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(navigate).not.toHaveBeenCalled()
      // Reopening should start a fresh menu with working dismissal.
      await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    }
  )
})
