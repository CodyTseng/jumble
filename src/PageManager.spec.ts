// @vitest-environment jsdom
import { act, createElement, createRef } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageManager, usePrimaryPage, useSecondaryPage } from './PageManager'

const prefs = vi.hoisted(() => ({ enableSingleColumnLayout: true, sidebarCollapse: false }))
let primary: ReturnType<typeof usePrimaryPage>
let secondary: ReturnType<typeof useSecondaryPage>
function Probe() {
  primary = usePrimaryPage()
  secondary = useSecondaryPage()
  return null
}
vi.mock('@/components/Sidebar', () => ({ default: () => createElement(Probe) }))
vi.mock('./providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: false, isLargeScreen: true })
}))
vi.mock('./providers/ThemeProvider', () => ({ useTheme: () => ({ themeSetting: 'light' }) }))
vi.mock('./providers/UserPreferencesProvider', () => ({ useUserPreferences: () => prefs }))
vi.mock('@/providers/CurrentRelaysProvider', () => ({
  CurrentRelaysProvider: ({ children }: any) => children
}))
vi.mock('./providers/NotificationProvider', () => ({
  NotificationProvider: ({ children }: any) => children
}))
vi.mock('./components/BackgroundAudio', () => ({ default: () => null }))
vi.mock('./components/BottomNavigationBar', () => ({ default: () => null }))
vi.mock('./components/DraftBox', () => ({ default: () => null }))
vi.mock('./components/DraftBox/DraftEditorHost', () => ({ default: () => null }))
vi.mock('./components/NewPost', () => ({ default: () => null }))
vi.mock('./components/TooManyRelaysAlertDialog', () => ({ default: () => null }))
vi.mock('./services/modal-manager.service', () => ({ default: { pop: () => null } }))
vi.mock('./routes/primary', () => {
  const names = ['home', 'notifications', 'search', 'relay', 'profile']
  return {
    PRIMARY_PAGE_MAP: Object.fromEntries(
      names.map((name) => [name, createElement('div', { 'data-page': name })])
    ),
    PRIMARY_PAGE_REF_MAP: Object.fromEntries(names.map((name) => [name, createRef()]))
  }
})
vi.mock('./routes/secondary', () => ({
  SECONDARY_ROUTES: [
    {
      matcher: (path: string) => (path.startsWith('/notes/') ? { params: {} } : false),
      element: createElement('div', { 'data-detail': true })
    }
  ]
}))
let root: Root
let host: HTMLDivElement
async function mount() {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(createElement(PageManager)))
}
async function reload() {
  await act(async () => root.unmount())
  host.remove()
  await mount()
}
async function travel(delta: number) {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.addEventListener('popstate', () => resolve(), { once: true })
      window.history.go(delta)
    })
  })
}
beforeEach(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  prefs.enableSingleColumnLayout = true
  window.history.replaceState(null, '', '/')
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
})
describe('primary page URL restoration', () => {
  it('replaces navigation without growing history and restores notifications on reload', async () => {
    window.history.replaceState({ unrelated: 42 }, '', '/?campaign=test#anchor')
    await mount()
    const length = window.history.length
    await act(async () => primary.navigate('notifications'))
    expect(window.location.search).toBe('?campaign=test&page=notifications')
    expect(window.location.hash).toBe('#anchor')
    expect(window.history.state.unrelated).toBe(42)
    expect(window.history.length).toBe(length)
    await reload()
    expect(primary.current).toBe('notifications')
    expect(window.history.length).toBe(length)
  })
  it('uses the current navigation state for keyboard Search after opening a detail', async () => {
    await mount()
    await act(async () => secondary.push('/notes/example'))
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })
    expect(primary.current).toBe('search')
    expect(window.location.search).toBe('?page=search')
    expect(host.querySelector('[data-detail]')).toBeNull()
    await reload()
    expect(primary.current).toBe('search')
  })
  it('uses the latest layout for keyboard Search', async () => {
    await mount()
    prefs.enableSingleColumnLayout = false
    await act(async () => root.render(createElement(PageManager)))
    await act(async () => secondary.push('/notes/example'))
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    })
    expect(primary.current).toBe('search')
    expect(window.location.pathname).toBe('/notes/example')
    expect(host.querySelector('[data-detail]')).not.toBeNull()
  })
  it('loads direct notification links', async () => {
    window.history.replaceState(null, '', '/?page=notifications')
    await mount()
    expect(primary.current).toBe('notifications')
  })
  it('restores notifications after closing a detail and reloading', async () => {
    await mount()
    await act(async () => primary.navigate('notifications'))
    await act(async () => secondary.push('/notes/example'))
    await act(async () => secondary.pop())
    expect(window.location.href).toContain('/?page=notifications')
    await reload()
    expect(primary.current).toBe('notifications')
  })
  it('supports actual history back and forward across a detail', async () => {
    await mount()
    await act(async () => primary.navigate('notifications'))
    await act(async () => secondary.push('/notes/example'))
    await travel(-1)
    expect(primary.current).toBe('notifications')
    expect(window.location.pathname).toBe('/')
    expect(host.querySelector('[data-detail]')).toBeNull()
    await travel(1)
    expect(primary.current).toBe('notifications')
    expect(window.location.pathname).toBe('/notes/example')
    expect(host.querySelector('[data-detail]')).not.toBeNull()
  })
  it('preserves a visible multi-column detail and its primary context across reload', async () => {
    prefs.enableSingleColumnLayout = false
    await mount()
    await act(async () => secondary.push('/notes/example?x=1#note'))
    await act(async () => primary.navigate('notifications'))
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/notes/example?x=1#note'
    )
    await reload()
    expect(primary.current).toBe('notifications')
    expect(host.querySelector('[data-detail]')).not.toBeNull()
    await act(async () => secondary.pop())
    expect(window.location.search).toBe('?page=notifications')
  })
  it('keeps the latest primary pane when browser Back closes a multi-column detail', async () => {
    prefs.enableSingleColumnLayout = false
    await mount()
    await act(async () => primary.navigate('notifications'))
    await act(async () => secondary.push('/notes/example'))
    await act(async () => primary.navigate('search'))
    await travel(-1)
    expect(primary.current).toBe('search')
    expect(window.location.search).toBe('?page=search')
    await travel(1)
    expect(primary.current).toBe('search')
    expect(window.location.pathname).toBe('/notes/example')
  })
  it('keeps primary changes while traversing multiple open details', async () => {
    prefs.enableSingleColumnLayout = false
    await mount()
    await act(async () => secondary.push('/notes/first'))
    await act(async () => secondary.push('/notes/second'))
    await act(async () => primary.navigate('search'))
    await travel(-1)
    expect(primary.current).toBe('search')
    expect(window.location.pathname).toBe('/notes/first')
    await reload()
    expect(primary.current).toBe('search')
    await travel(1)
    expect(primary.current).toBe('search')
    expect(window.location.pathname).toBe('/notes/second')
  })
  it('preserves a Home hash through detail reload and close', async () => {
    window.history.replaceState(null, '', '/#anchor')
    await mount()
    await act(async () => secondary.push('/notes/example'))
    await reload()
    await act(async () => secondary.pop())
    expect(window.location.hash).toBe('#anchor')
    expect(primary.current).toBe('home')
  })
  it('clears detail when navigating in single-column mode', async () => {
    await mount()
    await act(async () => secondary.push('/notes/example'))
    await act(async () => primary.navigate('notifications'))
    expect(window.location.pathname).toBe('/')
    expect(host.querySelector('[data-detail]')).toBeNull()
  })
  it('clears stale relay parameters when switching to notifications', async () => {
    window.history.replaceState(null, '', '/?r=wss%3A%2F%2Frelay.example&campaign=test')
    await mount()
    expect(primary.current).toBe('relay')
    await act(async () => primary.navigate('notifications'))
    expect(window.location.search).toBe('?campaign=test&page=notifications')
    await reload()
    expect(primary.current).toBe('notifications')
  })
  it('preserves an explicitly selected relay URL', async () => {
    await mount()
    await act(async () => primary.navigate('relay', { url: 'wss://relay.example' }))
    expect(new URLSearchParams(window.location.search).get('r')).toBe('wss://relay.example/')
    await reload()
    expect(primary.current).toBe('relay')
  })
  it('removes only the primary routing parameters for home', async () => {
    window.history.replaceState(null, '', '/?page=notifications&campaign=test#anchor')
    await mount()
    await act(async () => primary.navigate('home'))
    expect(window.location.search + window.location.hash).toBe('?campaign=test#anchor')
    await reload()
    expect(primary.current).toBe('home')
  })
})
