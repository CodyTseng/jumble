// @vitest-environment jsdom

import recentEmojiService from '@/services/recent-emoji.service'
import { Modal, ModalContent } from '@/components/ui/modal'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import EmojiContent from './EmojiContent'
import EmojiGrid from './EmojiGrid'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ allowInsecureConnection: false })
}))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: true })
}))
vi.mock('@/services/custom-emoji.service', () => ({
  default: {
    getEmojiId: (emoji: { url: string }) => emoji.url,
    getEmojiById: (id: string) => ({ url: id }),
    searchEmojis: async () => []
  }
}))
vi.mock('./useEmojiCollections', () => ({
  useEmojiCollections: () => ({
    nativeCategories: [],
    nativeLoading: false,
    standalone: [],
    packs: []
  })
}))

it('keeps recent emojis in place after image failures and picks, refreshing on reopen', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const broken = { shortcode: 'broken', url: 'https://example.com/broken.png' }
  recentEmojiService.add('😀')
  recentEmojiService.add(broken)
  // Guarantee deterministic ordering independent of timestamp resolution.
  recentEmojiService.add(broken)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const picked = vi.fn()
  const render = () => root.render(createElement(EmojiContent, { onEmojiClick: picked }))
  try {
    await act(async () => render())
    const buttons = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('section button'))
    expect(buttons().map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual([
      'broken',
      '😀'
    ])
    const smile = buttons()[1]
    await act(async () => {
      container.querySelector('img')!.dispatchEvent(new Event('error'))
    })
    expect(recentEmojiService.getRecent()).toEqual(['😀'])
    expect(buttons()).toHaveLength(2)
    expect(buttons()[1]).toBe(smile)
    // A parent rerender must not apply the changed service list either.
    await act(async () => render())
    expect(buttons()[1]).toBe(smile)
    await act(async () => smile.click())
    expect(picked).toHaveBeenCalledExactlyOnceWith('😀')
    expect(buttons()[1]).toBe(smile)
    await act(async () => root.render(null))
    await act(async () => render())
    expect(buttons()).toHaveLength(1)
    expect(buttons()[0].textContent).toBe('😀')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it.each([
  ['ltr', 0],
  ['ltr', 120],
  ['rtl', 0],
  ['rtl', 120]
] as const)(
  'allows drawer dismissal only at the list top (%s, scrollTop=%i), without selecting',
  async (dir, scrollTop) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    document.documentElement.dir = dir
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const picked = vi.fn()
    const changed = vi.fn()
    try {
      await act(async () =>
        root.render(
          createElement(
            Modal,
            { open: true, onOpenChange: changed },
            createElement(
              ModalContent,
              { title: 'Emojis', 'aria-describedby': undefined },
              createElement(EmojiGrid, {
                sections: [{ id: 'recent', type: 'mixed', items: ['😀', '❤️'] }],
                skinTone: 0,
                onPick: picked
              })
            )
          )
        )
      )
      const surface = document.querySelector<HTMLElement>('[role="dialog"]')!
      const button = surface.querySelector('section button') as HTMLButtonElement
      const viewport = button.closest<HTMLElement>('[data-radix-scroll-area-viewport]')!
      viewport.style.overflowY = 'auto'
      Object.defineProperties(viewport, {
        scrollHeight: { value: 1000, configurable: true },
        clientHeight: { value: 300, configurable: true }
      })
      viewport.scrollTop = scrollTop
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 100,
        right: 44,
        bottom: 144,
        width: 44,
        height: 44
      } as DOMRect)
      const pointer = (type: string, y: number) => {
        const event = new MouseEvent(type, { bubbles: true, clientX: 22, clientY: y, button: 0 })
        Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
        button.dispatchEvent(event)
      }
      const touch = (type: string, y: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperties(event, {
          touches: { value: type === 'touchend' ? [] : [{ clientX: 22, clientY: y }] },
          changedTouches: { value: [{ clientX: 22, clientY: y }] }
        })
        button.dispatchEvent(event)
      }
      await act(async () => {
        pointer('pointerdown', 122)
        touch('touchstart', 122)
        pointer('pointermove', 322)
        touch('touchmove', 322)
      })
      expect(surface.style.transform).toBe(scrollTop === 0 ? 'translate3d(0, 200px, 0)' : '')
      await act(async () => {
        touch('touchend', 322)
        pointer('pointerup', 322)
        // Simulate even a stray click after the sheet resets its transform.
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
      })
      if (scrollTop === 0) expect(changed).toHaveBeenCalledExactlyOnceWith(false)
      else expect(changed).not.toHaveBeenCalled()
      expect(picked).not.toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
      container.remove()
      document.documentElement.removeAttribute('dir')
      vi.restoreAllMocks()
    }
  }
)
