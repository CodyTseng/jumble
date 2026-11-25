// @vitest-environment jsdom

import DialogHost from '@/components/DialogHost'
import MutedNoteBadge from '@/components/MutedNoteBadge'
import { StorageKey } from '@/constants'
import type { Event } from 'nostr-tools'
import { act, createElement, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import NoteOptions from './index'

const state = vi.hoisted(() => ({ smallScreen: false }))

vi.mock('react-i18next', async () => {
  const { default: english } = await import('@/i18n/locales/en')
  const translations: Record<string, string> = english.translation
  return { useTranslation: () => ({ t: (text: string) => translations[text] ?? text }) }
})
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
  it('shows the mute indicator only after confirmation and removes it when unmuted', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    state.smallScreen = isSmallScreen
    localStorage.removeItem(StorageKey.MUTED_NOTE_NOTIFICATIONS)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const menuSelector = isSmallScreen ? '[role="dialog"]' : '[role="menu"]'
    const itemSelector = isSmallScreen ? 'button' : '[role="menuitem"]'
    const triggerButton = () => container.querySelector('button')!
    const muteIndicator = () =>
      container.querySelector('[role="img"][aria-label="Note notifications muted"]')
    const storedMute = () =>
      JSON.parse(localStorage.getItem(StorageKey.MUTED_NOTE_NOTIFICATIONS) ?? '{}').self?.[note.id]
    const render = () =>
      act(() =>
        root.render(
          createElement(
            Fragment,
            null,
            createElement(MutedNoteBadge, { event: note }),
            createElement(NoteOptions, { event: note }),
            createElement(DialogHost)
          )
        )
      )
    const openMenu = async () => {
      const trigger = triggerButton()
      await act(() => {
        if (isSmallScreen) trigger.click()
        else {
          trigger.focus()
          trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        }
      })
      return [...document.querySelector(menuSelector)!.querySelectorAll<HTMLElement>(itemSelector)]
    }
    const clickButton = async (surface: Element, label: string) => {
      const button = [...surface.querySelectorAll('button')].find((b) => b.textContent === label)!
      await act(() => button.click())
    }

    try {
      await render()
      expect(muteIndicator()).toBeNull()
      let items = await openMenu()
      const index = items.findIndex(({ textContent }) => textContent === 'Mute note notifications')
      expect(items[index].className).toContain('text-destructive')
      expect(items[index + 1].textContent).toBe('Mute user privately')
      expect(items[index + 2].textContent).toBe('Mute user publicly')

      await act(() => items[index].click())
      expect(document.querySelector(menuSelector)).toBeNull()
      let surface = document.querySelector('[role="alertdialog"]')!
      expect(surface.getAttribute('data-modal-presentation')).toBe(presentation)
      expect(surface.textContent).toContain('Notifications related to this note')
      expect(surface.textContent).toContain('won’t sync to other devices')
      expect(storedMute()).toBeUndefined()
      if (isSmallScreen) {
        await clickButton(surface, 'Cancel')
      } else {
        await act(() => {
          document.activeElement?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          )
        })
      }
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(storedMute()).toBeUndefined()
      expect(muteIndicator()).toBeNull()
      await vi.waitFor(() => expect(document.activeElement).toBe(triggerButton()))

      items = await openMenu()
      await act(() => items[index].click())
      surface = document.querySelector('[role="alertdialog"]')!
      await clickButton(surface, 'Confirm')
      expect(storedMute()).toBe(note.id)
      expect(muteIndicator()?.classList.contains('text-muted-foreground')).toBe(true)
      expect(muteIndicator()?.querySelector('.lucide-bell-off')).not.toBeNull()
      expect(muteIndicator()?.textContent).toBe('Note notifications muted')
      expect(triggerButton().querySelector('.lucide-bell-off')).toBeNull()
      await act(() => {
        muteIndicator()?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
      })
      expect(muteIndicator()?.textContent).toBe('')

      items = await openMenu()
      expect(items[index].textContent).toBe('Unmute note notifications')
      await act(() => items[index].click())
      expect(document.querySelector('[role="alertdialog"]')).toBeNull()
      expect(storedMute()).toBeUndefined()
      expect(muteIndicator()).toBeNull()
    } finally {
      await act(() => root.unmount())
      container.remove()
      localStorage.removeItem(StorageKey.MUTED_NOTE_NOTIFICATIONS)
      vi.unstubAllGlobals()
    }
  })
})
