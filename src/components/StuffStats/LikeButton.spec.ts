// @vitest-environment jsdom

import { LONG_PRESS_THRESHOLD } from '@/constants'
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LikeButton from './LikeButton'

const publish = vi.hoisted(() => vi.fn(async (draft) => ({ ...draft, id: 'reaction' })))
const screen = vi.hoisted(() => ({ small: false }))
const preferences = vi.hoisted(() => ({ quickReaction: true, quickReactionEmoji: '❤️' }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: screen.small })
}))
vi.mock('@/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => preferences
}))
vi.mock('@/providers/NostrProvider', () => ({
  useNostr: () => ({ pubkey: 'author', publish, checkLogin: (cb: () => void) => cb() })
}))
vi.mock('@/hooks/useStuff', () => ({
  useStuff: () => ({ event: { id: 'note' }, stuffKey: 'note' })
}))
vi.mock('@/hooks/useStuffStatsById', () => ({
  useStuffStatsById: () => ({ updatedAt: 1, likes: [] })
}))
vi.mock('@/hooks/useFilteredLikeCount', () => ({ useFilteredLikeCount: () => 0 }))
vi.mock('@/services/client.service', () => ({ default: { getSeenEventRelayUrls: () => [] } }))
vi.mock('@/services/stuff-stats.service', () => ({
  default: { updateStuffStatsByEvents: vi.fn() }
}))
vi.mock('@/lib/draft-event', () => ({
  createReactionDraftEvent: (_: unknown, emoji: string) => ({ content: emoji })
}))
vi.mock('../ExpressionPicker', () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (value: string) => void }) =>
    createElement('button', { onClick: () => onEmojiClick('😀') }, 'Pick emoji')
}))
vi.mock('../SuggestedEmojis', () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (value: string) => void }) =>
    createElement('button', { onClick: () => onEmojiClick('😀') }, 'Pick emoji')
}))

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.useFakeTimers()
  screen.small = false
  preferences.quickReaction = true
  publish.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(createElement(LikeButton, { stuff: 'note' })))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function pointer(type: string, y = 10) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: y })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: 'touch' }
  })
  container.querySelector('button')!.dispatchEvent(event)
}

function touch(type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : [{ clientX: 10, clientY: 10 }]
  })
  container.querySelector('button')!.dispatchEvent(event)
  return event
}

it('does not send the default emoji after a touch long press and compatibility mouse events', async () => {
  const trigger = container.querySelector('button')!
  await act(async () => {
    pointer('pointerdown')
    // Browsers may also dispatch touch events for this same pointer.
    touch('touchstart')
    vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
  })
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  await act(async () => {
    pointer('pointerup')
    touch('touchend')
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  })
  expect(publish).not.toHaveBeenCalled()
  const pick = Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent === 'Pick emoji'
  )!
  await act(async () => pick.click())
  expect(publish).toHaveBeenCalledOnce()
  expect(publish.mock.calls[0][0].content).toBe('😀')
})

it('still sends the default emoji for a short tap', async () => {
  await act(async () => {
    pointer('pointerdown')
    pointer('pointerup')
    container.querySelector('button')!.click()
  })
  expect(publish.mock.calls[0][0].content).toBe('❤️')
})

it.each([
  ['keyboard', 'pointerup'],
  ['assistive technology', 'pointerup'],
  ['keyboard', 'pointercancel'],
  ['assistive technology', 'pointercancel']
])(
  'allows %s activation after dismissing a touch long-press picker (%s)',
  async (activation, endEvent) => {
    const trigger = container.querySelector('button')!
    await act(async () => {
      pointer('pointerdown')
      touch('touchstart')
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
    })
    await act(async () => {
      pointer(endEvent)
      touch('touchend')
    })
    expect(publish).not.toHaveBeenCalled()
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await act(async () => {
      if (activation === 'keyboard') {
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      }
      // Both keyboard and assistive activations generate a click with detail=0.
      trigger.click()
    })
    expect(publish).toHaveBeenCalledOnce()
    expect(publish.mock.calls[0][0].content).toBe('❤️')
    // Even if a compatibility click arrives late, it must not send a second reaction.
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(publish).toHaveBeenCalledOnce()
    // An independent pointer interaction must still work.
    await act(async () => {
      pointer('pointerdown')
      pointer('pointerup')
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(publish).toHaveBeenCalledTimes(2)
  }
)

it('blocks selection without suppressing the native short-tap click', async () => {
  const trigger = container.querySelector('button')!
  const selection = new Event('selectstart', { bubbles: true, cancelable: true })
  await act(async () => {
    pointer('pointerdown')
    expect(touch('touchstart').defaultPrevented).toBe(false)
    trigger.dispatchEvent(selection)
    pointer('pointerup')
    touch('touchend')
  })
  expect(selection.defaultPrevented).toBe(true)
  expect(publish).not.toHaveBeenCalled()
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  })
  expect(publish).toHaveBeenCalledOnce()
  expect(publish.mock.calls[0][0].content).toBe('❤️')
})

it.each(['pointercancel', 'pointermove'] as const)(
  'does not synthesize a tap when a touch gesture ends with %s',
  async (type) => {
    await act(async () => {
      pointer('pointerdown')
      expect(touch('touchstart').defaultPrevented).toBe(false)
      pointer(type, 40)
      pointer('pointerup', 40)
      touch('touchend')
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
    })
    expect(publish).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  }
)

it('suppresses the native long-press menu while allowing the reaction picker to open', async () => {
  const trigger = container.querySelector('button')!
  const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  await act(async () => {
    pointer('pointerdown')
    trigger.dispatchEvent(contextMenu)
    vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
  })
  expect(contextMenu.defaultPrevented).toBe(true)
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(publish).not.toHaveBeenCalled()
})

it.each(['pointercancel', 'pointermove'] as const)('cancels long press on %s', async (type) => {
  await act(async () => {
    pointer('pointerdown')
    pointer(type, 40)
    vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
  })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(publish).not.toHaveBeenCalled()
})

it.each([true, false])(
  'opens the mobile picker with quickReaction=%s instead of sending a default reaction',
  async (quickReaction) => {
    screen.small = true
    preferences.quickReaction = quickReaction
    await act(async () => root.render(createElement(LikeButton, { stuff: 'note' })))
    const trigger = container.querySelector('button')!
    await act(async () => {
      pointer('pointerdown')
      touch('touchstart')
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await act(async () => {
      pointer('pointerup')
      touch('touchend')
      trigger.click()
    })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(publish).not.toHaveBeenCalled()
    const pick = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Pick emoji'
    )!
    await act(async () => pick.click())
    expect(publish).toHaveBeenCalledOnce()
    expect(publish.mock.calls[0][0].content).toBe('😀')
  }
)

it.each([
  [true, true],
  [true, false],
  [false, true],
  [false, false]
])(
  'leaves native scrolling available with smallScreen=%s and quickReaction=%s',
  async (small, quickReaction) => {
    screen.small = small
    preferences.quickReaction = quickReaction
    await act(async () => root.render(createElement(LikeButton, { stuff: 'note' })))
    const events: Event[] = []
    await act(async () => {
      pointer('pointerdown')
      events.push(touch('touchstart'))
      pointer('pointermove', 40)
      events.push(touch('touchmove'))
      pointer('pointercancel', 40)
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD)
    })
    // jsdom cannot scroll; check that the native events which enable scrolling
    // remain uncancelled, and that no picker or reaction hijacks the gesture.
    expect(events.every((event) => !event.defaultPrevented)).toBe(true)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(publish).not.toHaveBeenCalled()
  }
)

it('cancels a desktop long-press timer when switching to mobile layout', async () => {
  await act(async () => pointer('pointerdown'))
  screen.small = true
  await act(async () => root.render(createElement(LikeButton, { stuff: 'note' })))
  await act(async () => vi.advanceTimersByTime(LONG_PRESS_THRESHOLD))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(publish).not.toHaveBeenCalled()
})
