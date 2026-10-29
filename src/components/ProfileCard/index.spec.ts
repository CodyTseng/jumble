// @vitest-environment jsdom

import ClickableCard from '@/components/ClickableCard'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { toProfile } from '@/lib/link'
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ push: vi.fn(), follow: vi.fn(), pictures: true }))
const userId = '1'.repeat(64)
vi.mock('@/PageManager', () => ({
  useSecondaryPage: () => ({ push: state.push }),
  SecondaryPageLink: ({ children }: { children: React.ReactNode }) =>
    createElement('span', null, children)
}))
vi.mock('@/services/client.service', () => ({ default: {} }))
vi.mock('@/components/Emoji', () => ({ default: () => null }))
vi.mock('@/hooks', () => ({
  useFetchProfile: () => ({
    profile: { pubkey: '1'.repeat(64), username: 'Alice', about: 'Hello https://example.com' }
  })
}))
vi.mock('@/lib/device', () => ({ canHover: () => true }))
vi.mock('@/providers/ContentPolicyProvider', () => ({
  useContentPolicy: () => ({ autoLoadProfilePicture: state.pictures })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))
vi.mock('@/providers/TranslationServiceProvider', () => ({
  useTranslationService: () => ({ translateText: vi.fn() })
}))
vi.mock('@/components/Embedded', () => ({
  EmbeddedHashtag: () => null,
  EmbeddedMention: () => null,
  EmbeddedWebsocketUrl: () => null
}))
vi.mock('@/components/ExternalLink', () => ({
  default: ({ url }: { url: string }) => createElement('a', { href: url }, url)
}))
vi.mock('@/components/Image', () => ({ default: () => createElement('span', null, 'Avatar') }))
vi.mock('@/components/FollowButton', () => ({
  default: () => createElement('button', { onClick: state.follow }, 'Follow')
}))
vi.mock('@/components/Nip05', () => ({ default: () => null }))
vi.mock('@/components/TrustScoreBadge', () => ({ default: () => null }))
vi.mock('@/components/TextWithEmojis', () => ({
  default: ({ text }: { text: string }) => createElement('span', null, text)
}))
vi.mock('@/components/ui/hover-card', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/hover-card')>()
  return {
    ...actual,
    HoverCard: ({ children }: { children: React.ReactNode }) =>
      createElement(actual.HoverCard, { open: true }, children)
  }
})

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.pictures = true
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe.each([
  ['avatar', UserAvatar],
  ['username', Username]
] as const)('%s profile hover card', (_name, Entry) => {
  async function render() {
    const openNote = vi.fn()
    await act(async () => {
      root.render(
        createElement(ClickableCard, { onClick: openNote }, createElement(Entry, { userId }))
      )
    })
    return { openNote, surface: container.querySelector('[data-state="open"][data-side]')! }
  }

  it('isolates padding, blank space and bio clicks while allowing native document bubbling', async () => {
    const { openNote, surface } = await render()
    const documentClick = vi.fn()
    document.addEventListener('click', documentClick)
    try {
      for (const target of [
        surface,
        surface.firstElementChild!,
        surface.querySelector('[dir="auto"]')!
      ]) {
        const click = new MouseEvent('click', { bubbles: true, cancelable: true })
        await act(async () => {
          target.dispatchEvent(click)
        })
        expect(click.defaultPrevented).toBe(false)
      }
      expect(documentClick).toHaveBeenCalledTimes(3)
      expect(openNote).not.toHaveBeenCalled()
      expect(state.push).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('click', documentClick)
    }
  })

  it('opens the intended profile once using a focusable native button, not the note', async () => {
    const { openNote, surface } = await render()
    const avatar = surface.querySelector<HTMLButtonElement>('button[aria-label="Profile"]')!
    expect(avatar.type).toBe('button')
    // Radix hover cards intentionally remove descendants from the tab order.
    expect(avatar.tabIndex).toBe(-1)
    avatar.focus()
    expect(document.activeElement).toBe(avatar)
    // detail=0 is the click emitted by native keyboard activation (jsdom does not synthesize it).
    await act(async () => {
      avatar.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    })
    expect(state.push).toHaveBeenCalledExactlyOnceWith(toProfile(userId))
    expect(openNote).not.toHaveBeenCalled()
  })

  it('preserves bio links, follow actions and text selection without opening the note', async () => {
    const { openNote, surface } = await render()
    const link = surface.querySelector<HTMLAnchorElement>('a[href="https://example.com"]')!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    // Prevent jsdom navigation only after the component handlers have run.
    const observe = vi.fn((event: Event) => {
      expect(event.defaultPrevented).toBe(false)
      event.preventDefault()
    })
    document.addEventListener('click', observe, { once: true })
    await act(async () => {
      link.dispatchEvent(click)
    })
    expect(observe).toHaveBeenCalledOnce()
    const follow = [...surface.querySelectorAll('button')].find(
      (button) => button.textContent === 'Follow'
    )!
    await act(async () => follow.click())
    expect(state.follow).toHaveBeenCalledOnce()
    const bio = surface.querySelector('[dir="auto"]')!
    const range = document.createRange()
    range.selectNodeContents(bio)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    bio.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    expect(window.getSelection()!.toString()).toContain('Hello')
    expect(openNote).not.toHaveBeenCalled()
    expect(state.push).not.toHaveBeenCalled()
  })
})

it('keeps the username card isolated when profile pictures are disabled', async () => {
  state.pictures = false
  const openNote = vi.fn()
  await act(async () =>
    root.render(
      createElement(ClickableCard, { onClick: openNote }, createElement(Username, { userId }))
    )
  )
  const surface = container.querySelector('[data-state="open"][data-side]')!
  expect(surface.querySelector('[aria-label="Profile"]')).toBeNull()
  await act(async () => {
    surface.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  expect(openNote).not.toHaveBeenCalled()
})
