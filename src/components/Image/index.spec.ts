// @vitest-environment jsdom

import { act, createElement, useLayoutEffect } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Image from '.'

vi.mock('@/hooks/useBlossomUrl', () => ({
  useBlossomUrl: (url: string) => ({
    url,
    error: false,
    handleError: vi.fn(),
    markSuccess: vi.fn()
  })
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.useFakeTimers()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

it('keeps an image visible when it loads before passive effects run', async () => {
  function CachedAvatar() {
    useLayoutEffect(() => {
      container.querySelector('img')!.dispatchEvent(new Event('load'))
    }, [])
    return createElement(Image, { image: { url: 'https://example.com/avatar.jpg' } })
  }

  await act(async () => root.render(createElement(CachedAvatar)))
  await act(async () => vi.advanceTimersByTime(600))
  expect(container.querySelector('img')!.classList.contains('opacity-0')).toBe(false)
})

it('resets loading for a new source without an old fade timer hiding its skeleton', async () => {
  const renderImage = async (url: string) =>
    act(async () => root.render(createElement(Image, { image: { url } })))

  await renderImage('https://example.com/first.jpg')
  const first = container.querySelector('img')!
  await act(async () => first.dispatchEvent(new Event('load')))
  expect(first.classList.contains('opacity-0')).toBe(false)

  await renderImage('https://example.com/second.jpg')
  const second = container.querySelector('img')!
  expect(second).not.toBe(first)
  expect(second.getAttribute('src')).toBe('https://example.com/second.jpg')
  expect(second.classList.contains('opacity-0')).toBe(true)
  await act(async () => vi.advanceTimersByTime(600))
  expect(container.querySelector('.animate-pulse')).not.toBeNull()

  await act(async () => second.dispatchEvent(new Event('load')))
  expect(second.classList.contains('opacity-0')).toBe(false)
  await act(async () => vi.advanceTimersByTime(600))
  expect(container.querySelector('.animate-pulse')).toBeNull()
})
