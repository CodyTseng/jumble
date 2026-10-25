// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmojiPick } from './useEmojiPick'

let root: Root
let container: HTMLDivElement
let top: number
const picked = vi.fn()

function Cell({ emoji }: { emoji: string }) {
  return createElement('button', useEmojiPick(emoji, picked), emoji)
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  top = 100
  picked.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

async function render(emoji = '😀') {
  await act(async () => root.render(createElement(Cell, { emoji })))
  const button = container.querySelector('button')!
  vi.spyOn(button, 'getBoundingClientRect').mockImplementation(
    () => ({ left: 0, top, right: 44, bottom: top + 44, width: 44, height: 44 }) as DOMRect
  )
  return button
}

function pointer(button: HTMLButtonElement, type: string, x = 22, y = 122) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: 'touch' }
  })
  button.dispatchEvent(event)
}

function click(button: HTMLButtonElement) {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
}

describe('emoji pointer selection', () => {
  it('selects a stable tap exactly once, on click', async () => {
    const button = await render()
    pointer(button, 'pointerdown')
    pointer(button, 'pointerup')
    expect(picked).not.toHaveBeenCalled()
    click(button)
    click(button)
    expect(picked).toHaveBeenCalledExactlyOnceWith('😀')
  })

  it('allows small finger jitter during an ordinary tap', async () => {
    const button = await render()
    pointer(button, 'pointerdown')
    pointer(button, 'pointermove', 25, 125)
    pointer(button, 'pointerup', 25, 125)
    click(button)
    expect(picked).toHaveBeenCalledExactlyOnceWith('😀')
  })

  it('rejects a click retargeted to an emoji that was never pressed', async () => {
    await act(async () =>
      root.render(
        createElement(
          'div',
          null,
          createElement(Cell, { emoji: '😀' }),
          createElement(Cell, { emoji: '❤️' })
        )
      )
    )
    const [first, second] = container.querySelectorAll('button')
    pointer(first, 'pointerdown')
    pointer(first, 'pointerup')
    click(second)
    expect(picked).not.toHaveBeenCalled()
  })

  it('rejects a scroll even when the finger moves back before release', async () => {
    const button = await render()
    pointer(button, 'pointerdown')
    pointer(button, 'pointermove', 22, 142)
    pointer(button, 'pointerup')
    click(button)
    expect(picked).not.toHaveBeenCalled()
  })

  it('rejects a cancelled gesture and permits the next tap', async () => {
    const button = await render()
    pointer(button, 'pointerdown')
    pointer(button, 'pointercancel')
    click(button)
    expect(picked).not.toHaveBeenCalled()
    pointer(button, 'pointerdown')
    pointer(button, 'pointerup')
    click(button)
    expect(picked).toHaveBeenCalledExactlyOnceWith('😀')
  })

  it.each(['release', 'click'])('rejects drawer movement before %s', async (phase) => {
    const button = await render()
    pointer(button, 'pointerdown')
    if (phase === 'release') top += 15
    pointer(button, 'pointerup')
    if (phase === 'click') top += 15
    click(button)
    expect(picked).not.toHaveBeenCalled()
  })

  it('rejects a changed emoji in a reused button', async () => {
    const button = await render()
    pointer(button, 'pointerdown')
    await render('❤️')
    pointer(button, 'pointerup')
    click(button)
    expect(picked).not.toHaveBeenCalled()
  })

  it('allows keyboard and assistive-technology activation without a pointer', async () => {
    const button = await render()
    button.click()
    expect(picked).toHaveBeenCalledExactlyOnceWith('😀')
  })
})
