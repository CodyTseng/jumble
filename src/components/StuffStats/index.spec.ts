// @vitest-environment jsdom

import { act, createElement, useState } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import StuffStats from './index'

const screen = vi.hoisted(() => ({ small: false }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: screen.small })
}))
vi.mock('@/providers/NostrProvider', () => ({
  useNostr: () => ({ pubkey: 'self', checkLogin: (callback: () => void) => callback() })
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks', () => ({
  useFilteredAllReplies: () => ({ replies: [], hasReplied: false })
}))
vi.mock('@/hooks/useStuff', () => ({
  useStuff: () => ({ stuffKey: 'note', event: { id: 'note' } })
}))
vi.mock('@/hooks/useStuffStatsById', () => ({ useStuffStatsById: () => ({}) }))
vi.mock('@/hooks/useFilteredRepostCount', () => ({ useFilteredRepostCount: () => 0 }))
vi.mock('@/services/stuff-stats.service', () => ({ default: {} }))
vi.mock('@/lib/draft-event', () => ({ createRepostDraftEvent: vi.fn() }))
vi.mock('@/lib/event', () => ({ getNoteBech32Id: () => 'nevent1quoted' }))
vi.mock('../BookmarkButton', () => ({ default: () => null }))
vi.mock('./LikeButton', () => ({ default: () => null }))
vi.mock('./Likes', () => ({ default: () => null }))
vi.mock('./SeenOnButton', () => ({ default: () => null }))
vi.mock('./TopZaps', () => ({ default: () => null }))
vi.mock('./ZapButton', () => ({ default: () => null }))
// Keep the actual action buttons and their open state. A stateful editor body
// makes a responsive unmount observable without network or account providers.
vi.mock('../PostEditor', () => ({
  default: function MockPostEditor({
    open,
    defaultContent = ''
  }: {
    open: boolean
    defaultContent?: string
  }) {
    const [text, setText] = useState(defaultContent)
    return open
      ? createElement('textarea', {
          'aria-label': 'Draft',
          value: text,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value)
        })
      : null
  }
}))

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

async function render(small: boolean) {
  screen.small = small
  await act(async () => root.render(createElement(StuffStats, { stuff: 'note' })))
}

async function click(text: string) {
  const button = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="menuitem"]')
  ).find((element) => element.title === text || element.textContent?.trim() === text)!
  expect(button).toBeDefined()
  await act(async () => button.click())
}

it.each([false, true])(
  'preserves an open reply and draft across layout changes (mobile: %s)',
  async (small) => {
    await render(small)
    await click('Reply')
    const editor = document.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        editor,
        'Keep this reply'
      )
      editor.dispatchEvent(new Event('input', { bubbles: true }))
    })
    for (const next of [!small, small, !small]) {
      await render(next)
      expect(document.querySelector('textarea')).toBe(editor)
      expect(editor.value).toBe('Keep this reply')
    }
  }
)

it.each([false, true])(
  'preserves an open quote across layout changes (mobile: %s)',
  async (small) => {
    await render(small)
    if (small) {
      await click('Repost')
    } else {
      const trigger = document.querySelector<HTMLButtonElement>('[title="Repost"]')!
      await act(async () => {
        const event = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
        Object.defineProperty(event, 'pointerType', { value: 'mouse' })
        trigger.dispatchEvent(event)
      })
    }
    await click('Quote')
    const editor = document.querySelector('textarea')!
    expect(editor.value).toContain('nostr:nevent1quoted')
    for (const next of [!small, small, !small]) {
      await render(next)
      expect(document.querySelector('textarea')).toBe(editor)
      expect(editor.value).toContain('nostr:nevent1quoted')
    }
  }
)
