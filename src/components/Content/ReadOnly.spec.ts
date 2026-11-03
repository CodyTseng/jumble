// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadOnly from './ReadOnly'

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

describe('read-only preview content', () => {
  it.each(['click', 'auxclick'])(
    'blocks %s activation, including assistive technology clicks',
    async (type) => {
      const activate = vi.fn()
      await act(async () =>
        root.render(
          createElement(
            ReadOnly,
            null,
            createElement(
              'a',
              { href: '#destination', onClick: activate, onAuxClick: activate },
              'Readable link'
            )
          )
        )
      )
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, detail: 0 })
      await act(async () => container.querySelector('a')!.dispatchEvent(event))
      expect(event.defaultPrevented).toBe(true)
      expect(activate).not.toHaveBeenCalled()
      expect(container.textContent).toBe('Readable link')
      expect(container.querySelector('[inert], [aria-hidden="true"]')).toBeNull()
    }
  )

  it.each(['Enter', ' '])('blocks %s before descendants can open a menu', async (key) => {
    const activate = vi.fn()
    await act(async () =>
      root.render(
        createElement(
          ReadOnly,
          null,
          createElement('button', { onKeyDown: activate }, 'Readable control')
        )
      )
    )
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    await act(async () => container.querySelector('button')!.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(activate).not.toHaveBeenCalled()
  })

  it('lets Escape and pointer-down reach document for modal handling', async () => {
    await act(async () =>
      root.render(createElement(ReadOnly, null, createElement('button', null, 'Readable control')))
    )
    const pointerDown = vi.fn()
    const keyDown = vi.fn()
    document.addEventListener('pointerdown', pointerDown)
    document.addEventListener('keydown', keyDown)
    try {
      const button = container.querySelector('button')!
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })
      await act(async () => {
        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
        button.dispatchEvent(escape)
      })
      expect(pointerDown).toHaveBeenCalledOnce()
      expect(keyDown).toHaveBeenCalledOnce()
      expect(escape.defaultPrevented).toBe(false)
    } finally {
      document.removeEventListener('pointerdown', pointerDown)
      document.removeEventListener('keydown', keyDown)
    }
  })
})
