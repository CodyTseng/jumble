// @vitest-environment jsdom

import { act, createElement, Fragment } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { RemoveScrollBar } from 'react-remove-scroll-bar'
import { afterEach, beforeEach, expect, it } from 'vitest'
import Lightbox from './index'

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

it('shares scrollbar compensation with dialogs and keeps their lock when the lightbox closes', async () => {
  const render = async (showLightbox: boolean) =>
    act(async () => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement(RemoveScrollBar),
          showLightbox && createElement(Lightbox, { open: true, slides: [] })
        )
      )
    })

  await render(false)
  const compensation = getComputedStyle(document.body).getPropertyValue(
    '--removed-body-scroll-bar-size'
  )
  expect(compensation).not.toBe('')

  await render(true)
  expect(document.body.getAttribute('data-scroll-locked')).toBe('2')
  expect(document.body.classList.contains('yarl__no_scroll')).toBe(false)
  expect(document.body.style.paddingRight).toBe('')
  expect(getComputedStyle(document.body).getPropertyValue('--removed-body-scroll-bar-size')).toBe(
    compensation
  )

  await render(false)
  expect(document.body.getAttribute('data-scroll-locked')).toBe('1')
  await act(async () => root.render(null))
  expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
})

it('respects the lightbox option to disable scroll locking', async () => {
  await act(async () => {
    root.render(createElement(Lightbox, { open: true, slides: [], noScroll: { disabled: true } }))
  })
  expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
  expect(document.body.classList.contains('yarl__no_scroll')).toBe(false)
})
