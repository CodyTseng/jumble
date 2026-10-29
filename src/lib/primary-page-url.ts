import type { TPrimaryPageName } from '@/routes/primary'
import { normalizeUrl } from './url'

const PARAMETERLESS_PAGES: TPrimaryPageName[] = [
  'home',
  'following',
  'notifications',
  'dms',
  'longFormEditor',
  'me',
  'profile',
  'search',
  'bookmark',
  'settings'
]

export function readPrimaryPageUrl(value: string): {
  page: TPrimaryPageName
  props?: { url: string }
} {
  const url = new URL(value, 'https://jumble.invalid')
  const page = url.searchParams.get('page') as TPrimaryPageName | null
  if (page && PARAMETERLESS_PAGES.includes(page)) return { page }
  const r = url.searchParams.get('r')
  const relay = r ? normalizeUrl(r) : ''
  if (relay) return { page: 'relay', props: { url: relay } }
  return { page: 'home' }
}

export function primaryPageUrl(
  previous: string,
  page: TPrimaryPageName,
  props?: { url?: string }
): string {
  const url = new URL(previous, 'https://jumble.invalid')
  url.pathname = '/'
  url.searchParams.delete('page')
  url.searchParams.delete('r')
  if (page === 'relay') {
    const relay = props?.url ? normalizeUrl(props.url) : ''
    if (relay) url.searchParams.set('r', relay)
  } else if (page !== 'home' && PARAMETERLESS_PAGES.includes(page)) {
    url.searchParams.set('page', page)
  }
  return url.pathname + url.search + url.hash
}

export function initialPrimaryUrl(location: Location, state: unknown): string {
  // A detail entry keeps its primary pane separately, without changing its shareable URL.
  const saved = (state as { primaryUrl?: unknown } | null)?.primaryUrl
  if (location.pathname !== '/' && typeof saved === 'string' && /^\/(?:[?#]|$)/.test(saved)) {
    return saved
  }
  if (location.pathname !== '/') return '/'
  return location.pathname + location.search + location.hash
}
