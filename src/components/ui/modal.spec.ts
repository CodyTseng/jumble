// @vitest-environment jsdom

import DialogHost from '@/components/DialogHost'
import dialogService from '@/services/dialog.service'
import ResponsiveDialog from '@/components/ResponsiveDialog'
import { act, createElement, useEffect, useState } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from './alert-dialog'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog'
import { Modal, ModalContent, ModalDescription } from './modal'

const screen = vi.hoisted(() => ({ small: false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: screen.small })
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  screen.small = false
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function StatefulBody({ mounted }: { mounted: () => void }) {
  const [value, setValue] = useState(0)
  useEffect(mounted, [mounted])
  return createElement(
    'section',
    null,
    createElement(ModalDescription, null, 'Stateful content'),
    createElement('button', { onClick: () => setValue(value + 1) }, `Count ${value}`)
  )
}

describe('responsive modals', () => {
  it.each(['dialog', 'modal', 'responsive-dialog'] as const)(
    'keeps %s content mounted and state intact when switching presentation',
    async (kind) => {
      const mounted = vi.fn()
      const render = async () =>
        act(async () => {
          const body = createElement(StatefulBody, { mounted })
          root.render(
            kind === 'responsive-dialog'
              ? createElement(ResponsiveDialog, {
                  open: true,
                  onOpenChange: vi.fn(),
                  children: body
                })
              : kind === 'dialog'
                ? createElement(Dialog, { open: true }, createElement(DialogContent, null, body))
                : createElement(Modal, { open: true }, createElement(ModalContent, null, body))
          )
        })
      await render()
      const surface = document.querySelector('[role="dialog"]')!
      const body = surface.querySelector<HTMLElement>('[data-modal-body]')!
      body.scrollTop = 127
      const button = Array.from(surface.querySelectorAll('button')).find(
        (b) => b.textContent === 'Count 0'
      )!
      await act(async () => button.click())
      for (const small of [true, false, true]) {
        screen.small = small
        await render()
        expect(document.querySelector('[role="dialog"]')).toBe(surface)
        expect(button.textContent).toBe('Count 1')
        expect(surface.querySelector('[data-modal-body]')).toBe(body)
        expect(body.scrollTop).toBe(127)
        const handle = surface.querySelector('[data-modal-handle]')
        if (small) {
          expect(handle?.parentElement).toBe(surface)
          expect(body.contains(handle)).toBe(false)
        } else {
          expect(handle).toBeNull()
        }
        expect(surface.getAttribute('data-modal-presentation')).toBe(small ? 'bottom' : 'center')
      }
      expect(mounted).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    ['surface', 'surface', 120],
    ['surface', 'child', 120],
    ['inner', 'child', 120],
    ['body', 'body', 120],
    ['body', 'child', 120],
    ['body', 'handle', 120],
    ['surface', 'surface', 0],
    ['surface', 'child', 0],
    ['inner', 'child', 0],
    ['body', 'body', 0],
    ['body', 'child', 0]
  ] as const)(
    'handles downward swipes with %s scrolling, a %s target and scrollTop=%i',
    async (scrollContainer, touchTarget, scrollTop) => {
      screen.small = true
      const changed = vi.fn()
      await act(async () =>
        root.render(
          createElement(
            Dialog,
            { open: true, onOpenChange: changed },
            createElement(
              DialogContent,
              { 'aria-describedby': undefined },
              createElement(
                'div',
                { 'data-scroll-body': true },
                createElement('span', null, 'Content')
              )
            )
          )
        )
      )
      const surface = document.querySelector<HTMLElement>('[role="dialog"]')!
      const inner = surface.querySelector<HTMLElement>('[data-scroll-body]')!
      const body = surface.querySelector<HTMLElement>('[data-modal-body]')!
      const scroller =
        scrollContainer === 'surface' ? surface : scrollContainer === 'body' ? body : inner
      scroller.style.overflowY = 'auto'
      Object.defineProperties(scroller, {
        scrollHeight: { configurable: true, value: 1000 },
        clientHeight: { configurable: true, value: 400 }
      })
      scroller.scrollTop = scrollTop
      const target =
        touchTarget === 'surface'
          ? surface
          : touchTarget === 'body'
            ? body
            : touchTarget === 'handle'
              ? surface.querySelector<HTMLElement>('[data-modal-handle]')!
              : inner.querySelector('span')!
      const touch = (type: string, y: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperties(event, {
          touches: { value: type === 'touchend' ? [] : [{ clientY: y }] },
          changedTouches: { value: [{ clientY: y }] }
        })
        target.dispatchEvent(event)
        return event
      }
      let move!: Event
      await act(async () => {
        touch('touchstart', 100)
        move = touch('touchmove', 300)
      })
      const shouldDismiss = touchTarget === 'handle' || scrollTop === 0
      expect(move.defaultPrevented).toBe(shouldDismiss)
      expect(surface.style.transform).toBe(shouldDismiss ? 'translate3d(0, 200px, 0)' : '')
      await act(async () => {
        touch('touchend', 300)
      })
      if (shouldDismiss) expect(changed).toHaveBeenCalledExactlyOnceWith(false)
      else expect(changed).not.toHaveBeenCalled()
    }
  )

  it('notifies uncontrolled callers on both trigger open and close', async () => {
    const changed = vi.fn()
    await act(async () =>
      root.render(
        createElement(
          Dialog,
          { onOpenChange: changed },
          createElement(DialogTrigger, null, 'Open'),
          createElement(
            DialogContent,
            { 'aria-describedby': undefined },
            createElement(DialogTitle, null, 'Example')
          )
        )
      )
    )
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
    expect(changed).toHaveBeenLastCalledWith(true)
    const surface = document.querySelector('[role="dialog"]')!
    const titles = document.querySelectorAll(`[id="${surface.getAttribute('aria-labelledby')}"]`)
    expect(titles).toHaveLength(1)
    expect(titles[0].textContent).toBe('Example')
    const close = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Close'
    )!
    await act(async () => close.click())
    expect(changed).toHaveBeenLastCalledWith(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(changed.mock.calls).toEqual([[true], [false]])
  })

  it('clears keyboard avoidance when changing from a sheet to a centered dialog', async () => {
    screen.small = true
    const viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    vi.stubGlobal('innerHeight', 800)
    const render = () =>
      act(async () =>
        root.render(
          createElement(
            Modal,
            { open: true },
            createElement(
              ModalContent,
              { title: 'Input', 'aria-describedby': undefined },
              createElement('input')
            )
          )
        )
      )
    await render()
    const surface = document.querySelector<HTMLElement>('[role="dialog"]')!
    const input = surface.querySelector('input')!
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ bottom: 600 } as DOMRect)
    await act(async () => input.focus())
    expect(surface.style.bottom).toBe('112px')
    screen.small = false
    await render()
    expect(document.querySelector('[role="dialog"]')).toBe(surface)
    expect(surface.style.bottom).toBe('')
  })

  it('advances from a prompt to a queued confirmation without a stale close cancelling it', async () => {
    screen.small = true
    const named = dialogService.prompt('Name', 'My relays')
    const confirmed = dialogService.confirm('Continue?')
    await act(async () => root.render(createElement(DialogHost)))
    expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('My relays')
    await act(async () => {
      document
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await expect(named).resolves.toBe('My relays')
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Continue?')
    const cancel = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    )!
    await act(async () => cancel.click())
    await expect(confirmed).resolves.toBe(false)
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('retains an explicitly anchored navigation sheet', async () => {
    await act(async () =>
      root.render(
        createElement(
          Modal,
          { open: true, direction: 'left' },
          createElement(
            ModalContent,
            { title: 'Navigation', 'aria-describedby': undefined },
            'Menu'
          )
        )
      )
    )
    expect(document.querySelector('[role="dialog"]')?.getAttribute('data-modal-presentation')).toBe(
      'left'
    )
  })

  it('keeps alert semantics and cancel focus while adapting to a mobile sheet', async () => {
    const changed = vi.fn()
    const confirmed = vi.fn()
    const render = () =>
      act(async () =>
        root.render(
          createElement(
            AlertDialog,
            { defaultOpen: true, onOpenChange: changed },
            createElement(
              AlertDialogContent,
              null,
              createElement(AlertDialogTitle, null, 'Delete?'),
              createElement(AlertDialogDescription, null, 'Confirm deletion'),
              createElement(AlertDialogCancel, null, 'Cancel'),
              createElement(AlertDialogAction, { onClick: confirmed }, 'Delete')
            )
          )
        )
      )
    await render()
    const surface = document.querySelector('[role="alertdialog"]')!
    const cancel = Array.from(surface.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    )!
    expect(document.activeElement).toBe(cancel)
    screen.small = true
    await render()
    expect(document.querySelector('[role="alertdialog"]')).toBe(surface)
    expect(surface.getAttribute('data-modal-presentation')).toBe('bottom')
    await act(async () =>
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    )
    expect(document.querySelector('[role="alertdialog"]')).toBe(surface)
    expect(changed).not.toHaveBeenCalled()
    await act(async () => cancel.click())
    expect(changed).toHaveBeenLastCalledWith(false)
    expect(changed.mock.calls).toEqual([[false]])
    expect(confirmed).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })
})
