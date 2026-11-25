// @vitest-environment jsdom

import DialogHost from '@/components/DialogHost'
import type { Event } from 'nostr-tools'
import { act, createElement, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import NoteOptions from './index'

const state = vi.hoisted(() => ({
  smallScreen: false,
  muted: new Set<string>(),
  setNoteMuted: vi.fn()
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }))
vi.mock('@/PageManager', () => ({ useSecondaryPage: () => ({ push: vi.fn() }) }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: state.smallScreen })
}))
vi.mock('@/providers/NostrProvider', () => ({ useNostr: () => ({ pubkey: 'self' }) }))
vi.mock('@/providers/CurrentRelaysProvider', () => ({
  useCurrentRelays: () => ({ relayUrls: [] })
}))
vi.mock('@/providers/FavoriteRelaysProvider', () => ({
  useFavoriteRelays: () => ({ favoriteRelays: [], relaySets: [] })
}))
vi.mock('@/providers/MuteListProvider', () => ({
  useMuteList: () => ({ mutePubkeySet: new Set() })
}))
vi.mock('@/providers/PinListProvider', () => ({
  usePinList: () => ({ pinnedEventHexIdSet: new Set() })
}))
vi.mock('@/providers/BookmarksProvider', () => ({ useBookmarks: () => ({}) }))
vi.mock('@/services/client.service', () => ({ default: {} }))
vi.mock('@/services/indexed-db.service', () => ({ default: {} }))
vi.mock('./RawEventDialog', () => ({ default: () => null }))
vi.mock('./ReportDialog', () => ({ default: () => null }))
vi.mock('@/hooks/useMutedNoteNotifications', () => ({
  useMutedNoteNotifications: () => ({
    mutedNoteKeys: state.muted,
    setNoteMuted: state.setNoteMuted
  })
}))

const note: Event = {
  id: '1'.repeat(64),
  pubkey: '2'.repeat(64),
  sig: '3'.repeat(128),
  kind: 1,
  created_at: 0,
  content: '',
  tags: []
}

describe.each([
  [false, 'center'],
  [true, 'bottom']
] as const)('note notifications confirmation (%s small screen)', (isSmallScreen, presentation) => {
  it('groups the action with mute options and only mutes after confirmation', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    state.smallScreen = isSmallScreen
    state.muted.clear()
    state.setNoteMuted.mockClear()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const menuSelector = isSmallScreen ? '[role="dialog"]' : '[role="menu"]'
    const itemSelector = isSmallScreen ? 'button' : '[role="menuitem"]'
    const render = () =>
      act(() =>
        root.render(
          createElement(
            Fragment,
            null,
            createElement(NoteOptions, { event: note }),
            createElement(DialogHost)
          )
        )
      )
    const openMenu = async () => {
      const trigger = container.querySelector('button')!
      await act(() => {
        if (isSmallScreen) trigger.click()
        else trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      return [...document.querySelector(menuSelector)!.querySelectorAll<HTMLElement>(itemSelector)]
    }
    const clickButton = async (surface: Element, label: string) => {
      const button = [...surface.querySelectorAll('button')].find((b) => b.textContent === label)!
      await act(() => button.click())
    }

    try {
      await render()
      let items = await openMenu()
      const index = items.findIndex(({ textContent }) => textContent === 'Mute notifications')
      expect(items[index].className).toContain('text-destructive')
      expect(items[index + 1].textContent).toBe('Mute user privately')
      expect(items[index + 2].textContent).toBe('Mute user publicly')

      await act(() => items[index].click())
      expect(document.querySelector(menuSelector)).toBeNull()
      let surface = document.querySelector('[role="alertdialog"]')!
      expect(surface.getAttribute('data-modal-presentation')).toBe(presentation)
      expect(surface.textContent).toContain('Notifications related to this note')
      expect(surface.textContent).toContain('won’t sync to other devices')
      expect(state.setNoteMuted).not.toHaveBeenCalled()
      await clickButton(surface, 'Cancel')
      expect(state.setNoteMuted).not.toHaveBeenCalled()

      items = await openMenu()
      await act(() => items[index].click())
      surface = document.querySelector('[role="alertdialog"]')!
      await clickButton(surface, 'Confirm')
      expect(state.setNoteMuted).toHaveBeenCalledExactlyOnceWith(note, true)

      state.muted.add(note.id)
      await render()
      items = await openMenu()
      expect(items[index].textContent).toBe('Unmute notifications')
      await act(() => items[index].click())
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(state.setNoteMuted).toHaveBeenLastCalledWith(note, false)
    } finally {
      await act(() => root.unmount())
      container.remove()
      vi.unstubAllGlobals()
    }
  })
})
