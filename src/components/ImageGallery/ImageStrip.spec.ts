// @vitest-environment jsdom

import ClickableCard from '@/components/ClickableCard'
import { act, createElement, type ImgHTMLAttributes } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImageStrip from './ImageStrip'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } })
}))
vi.mock('../Image', () => ({
  default: ({ onImageLoad }: { onImageLoad?: (url: string, img: HTMLImageElement) => void }) =>
    createElement(
      'span',
      null,
      'photo',
      createElement<ImgHTMLAttributes<HTMLImageElement>>('img', {
        onLoad: (event) => onImageLoad?.('', event.currentTarget)
      })
    )
}))

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

it('keeps the reserved row height and other card widths when a wide photo loads', async () => {
  await act(async () =>
    root.render(
      createElement(ImageStrip, {
        images: [{ url: 'slow.jpg' }, { url: 'known.jpg', dim: { width: 900, height: 1600 } }],
        onPhotoClick: vi.fn()
      })
    )
  )
  const [slow, known] = container.querySelectorAll<HTMLButtonElement>('button')
  const track = slow.parentElement!
  const reservedHeight = track.style.getPropertyValue('--gallery-height')
  const slowWidth = slow.style.width
  const knownWidth = known.style.width
  const img = slow.querySelector('img')!
  Object.defineProperties(img, {
    naturalWidth: { value: 3000 },
    naturalHeight: { value: 1000 }
  })
  await act(async () => img.dispatchEvent(new Event('load')))
  expect(slow.style.width).not.toBe(slowWidth)
  expect(known.style.width).toBe(knownWidth)
  expect(track.style.getPropertyValue('--gallery-height')).toBe(reservedHeight)
})

it('updates pagination after a resize without moving the viewport', async () => {
  await act(async () =>
    root.render(
      createElement(ImageStrip, {
        images: [{ url: 'slow.jpg' }, { url: 'last.jpg' }],
        onPhotoClick: vi.fn()
      })
    )
  )
  const [first, last] = container.querySelectorAll<HTMLButtonElement>('button')
  const viewport = first.parentElement!.parentElement!
  let firstWidth = 204
  const scrollTo = vi.fn()
  Object.defineProperties(viewport, {
    clientWidth: { value: 400 },
    scrollWidth: { get: () => firstWidth + 212 },
    scrollTo: { value: scrollTo },
    getBoundingClientRect: { value: () => new DOMRect(0, 0, 400, 170) }
  })
  first.getBoundingClientRect = () => new DOMRect(-viewport.scrollLeft, 0, firstWidth, 170)
  last.getBoundingClientRect = () => new DOMRect(firstWidth + 8 - viewport.scrollLeft, 0, 204, 170)
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  await act(async () => resizeGallery())
  const dots = container.querySelectorAll<HTMLButtonElement>(
    '[aria-label="Go to image {{number}} of {{total}}"]'
  )
  await act(async () => dots[1].click())
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 16, behavior: 'smooth' })
  viewport.scrollLeft = 16
  await act(async () => viewport.dispatchEvent(new Event('scrollend')))

  firstWidth = 340
  await act(async () => resizeGallery())
  expect(viewport.scrollLeft).toBe(16)
  expect(scrollTo).toHaveBeenCalledTimes(1)
  await act(async () => dots[1].click())
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 152, behavior: 'smooth' })
})

describe('gallery mouse dragging inside a note card', () => {
  it.each([
    { input: 'wheel', preview: false },
    { input: 'pointerdown', preview: false },
    { input: 'wheel', preview: true },
    { input: 'pointerdown', preview: true }
  ])(
    'keeps pagination working until completion or $input input (preview: $preview)',
    async ({ input, preview }) => {
      await act(async () =>
        root.render(
          createElement(ImageStrip, {
            images: Array.from({ length: 4 }, (_, index) => ({ url: `${index}.jpg` })),
            onPhotoClick: preview ? undefined : vi.fn()
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

  it('opens the note from gaps and edges while keeping photo clicks and document listeners working', async () => {
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
      expect(navigate).toHaveBeenCalledTimes(2)
      expect(documentClick).toHaveBeenCalledTimes(2)

      await act(async () => button.click())
      expect(openPhoto).toHaveBeenCalledOnce()
      expect(navigate).toHaveBeenCalledTimes(2)

      await act(async () => (container.firstElementChild as HTMLElement).click())
      expect(navigate).toHaveBeenCalledTimes(3)
    } finally {
      document.removeEventListener('click', documentClick)
    }
  })

  it.each(
    ['image', 'gap', 'edge'].flatMap((origin) =>
      [false, true].map((preview) => ({ origin, preview }))
    )
  )(
    'allows dragging from the $origin without opening the photo or note (preview: $preview)',
    async ({ origin, preview }) => {
      const navigate = vi.fn()
      const openPhoto = vi.fn()
      await act(async () =>
        root.render(
          createElement(
            ClickableCard,
            { onClick: navigate },
            createElement(ImageStrip, {
              images: [{ url: 'one.jpg' }, { url: 'two.jpg' }],
              onPhotoClick: preview ? undefined : openPhoto
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

        // A fresh click opens photos only when the lightbox action is enabled.
        await act(async () => {
          photo.dispatchEvent(pointer('pointerdown', 60))
          photo.dispatchEvent(pointer('pointerup', 60))
          photo.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
        })
        expect(openPhoto).toHaveBeenCalledTimes(preview ? 0 : 1)
        expect(navigate).not.toHaveBeenCalled()
      } finally {
        document.removeEventListener('click', documentClick)
      }
    }
  )
})
