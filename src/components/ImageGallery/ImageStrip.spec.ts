// @vitest-environment jsdom

import ClickableCard from '@/components/ClickableCard'
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImageStrip from './ImageStrip'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } })
}))
vi.mock('../Image', () => ({ default: () => createElement('span', null, 'photo') }))

let root: Root
let container: HTMLDivElement
let resizeGallery: () => void
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeGallery = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function pointer(type: string, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX })
  Object.defineProperties(event, {
    pointerType: { value: 'mouse' },
    pointerId: { value: 1 }
  })
  return event
}

describe('gallery mouse dragging inside a note card', () => {
  it.each(['wheel', 'pointerdown'])(
    'keeps the clicked dot active through intermediate positions until completion or %s input',
    async (input) => {
      await act(async () =>
        root.render(
          createElement(ImageStrip, {
            images: Array.from({ length: 4 }, (_, index) => ({ url: `${index}.jpg` })),
            onPhotoClick: vi.fn()
          })
        )
      )
      const slides = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      const viewport = slides[0].parentElement!.parentElement!
      Object.defineProperties(viewport, {
        clientWidth: { value: 100 },
        scrollWidth: { value: 430 },
        scrollTo: { value: vi.fn() },
        getBoundingClientRect: { value: () => new DOMRect(0, 0, 100, 100) }
      })
      slides.forEach((slide, index) => {
        slide.getBoundingClientRect = () =>
          new DOMRect(index * 110 - viewport.scrollLeft, 0, 100, 100)
      })
      vi.stubGlobal('matchMedia', () => ({ matches: false }))
      let nextFrame: FrameRequestCallback
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        nextFrame = callback
        return 1
      })
      await act(async () => resizeGallery())
      const dots = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[aria-label="Go to image {{number}} of {{total}}"]'
        )
      )
      const scrollTo = async (position: number) => {
        await act(async () => {
          viewport.scrollLeft = position
          viewport.dispatchEvent(new Event('scroll'))
          nextFrame(0)
        })
      }
      await act(async () => dots[2].click())
      expect(dots[2].getAttribute('aria-current')).toBe('true')
      for (const position of [10, 110, 170, 220]) {
        await scrollTo(position)
        expect(dots[2].getAttribute('aria-current')).toBe('true')
      }
      // After reaching the target, ordinary scrolling follows the visible image.
      await scrollTo(110)
      expect(dots[1].getAttribute('aria-current')).toBe('true')

      await act(async () => dots[3].click())
      await scrollTo(160)
      expect(dots[3].getAttribute('aria-current')).toBe('true')
      await act(async () =>
        viewport.dispatchEvent(
          input === 'wheel'
            ? new WheelEvent('wheel', { bubbles: true })
            : pointer('pointerdown', 100)
        )
      )
      await scrollTo(110)
      expect(dots[1].getAttribute('aria-current')).toBe('true')
    }
  )

  it('ignores clicks in the gaps without blocking document listeners or other note clicks', async () => {
    const navigate = vi.fn()
    const openPhoto = vi.fn()
    await act(async () =>
      root.render(
        createElement(
          ClickableCard,
          { onClick: navigate },
          createElement(ImageStrip, {
            images: [{ url: 'one.jpg' }, { url: 'two.jpg' }],
            onPhotoClick: openPhoto
          })
        )
      )
    )
    const button = container.querySelector('button')!
    const track = button.parentElement!
    const viewport = track.parentElement!
    const documentClick = vi.fn()
    document.addEventListener('click', documentClick)
    try {
      // Gaps target the flex track; empty space at the edge targets the viewport.
      await act(async () => {
        track.click()
        viewport.click()
      })
      expect(openPhoto).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
      expect(documentClick).toHaveBeenCalledTimes(2)

      await act(async () => (container.firstElementChild as HTMLElement).click())
      expect(navigate).toHaveBeenCalledOnce()
    } finally {
      document.removeEventListener('click', documentClick)
    }
  })

  it.each(['image', 'gap', 'edge'])(
    'allows dragging from the %s without opening the photo or note',
    async (origin) => {
      const navigate = vi.fn()
      const openPhoto = vi.fn()
      await act(async () =>
        root.render(
          createElement(
            ClickableCard,
            { onClick: navigate },
            createElement(ImageStrip, {
              images: [{ url: 'one.jpg' }, { url: 'two.jpg' }],
              onPhotoClick: openPhoto
            })
          )
        )
      )
      const photo = container.querySelector('span')!
      const button = photo.closest('button')!
      const track = button.parentElement!
      const viewport = track.parentElement!
      const source = origin === 'image' ? photo : origin === 'gap' ? track : viewport
      let captured: Element | undefined
      // jsdom doesn't implement pointer capture; record its target and dispatch the
      // release/click there, as the browser does for a captured pointer.
      for (const element of [button, viewport]) {
        Object.defineProperty(element, 'setPointerCapture', {
          value: () => {
            captured = element
          }
        })
      }
      await act(async () => {
        source.dispatchEvent(pointer('pointerdown', 100))
        source.dispatchEvent(pointer('pointermove', 60))
      })
      expect(captured).toBe(origin === 'image' ? button : viewport)
      expect(viewport.scrollLeft).toBe(40)

      const documentClick = vi.fn()
      document.addEventListener('click', documentClick)
      try {
        await act(async () => {
          captured!.dispatchEvent(pointer('pointerup', 60))
          captured!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
        })
        expect(openPhoto).not.toHaveBeenCalled()
        expect(navigate).not.toHaveBeenCalled()
        expect(documentClick).toHaveBeenCalledOnce()

        // A fresh, stationary click must still open the photo.
        await act(async () => {
          photo.dispatchEvent(pointer('pointerdown', 60))
          photo.dispatchEvent(pointer('pointerup', 60))
          photo.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
        })
        expect(openPhoto).toHaveBeenCalledOnce()
        expect(navigate).not.toHaveBeenCalled()
      } finally {
        document.removeEventListener('click', documentClick)
      }
    }
  )
})
