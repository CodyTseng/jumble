import { useScreenSize } from '@/providers/ScreenSizeProvider'
import gifService, { useGifCollections } from '@/services/gif.service'
import klipyService, { TGif } from '@/services/klipy.service'
import { TGifRecord } from '@/types'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GifGrid from './GifGrid'
import GifPickerSearch from './GifPickerSearch'
import GifPickerTabs, { TGifTabId } from './GifPickerTabs'

const PAGE_LIMIT = 24
const SEARCH_DEBOUNCE_MS = 300

export default function GifPicker({
  onGifClick
}: {
  onGifClick: (gif: TGif) => void
}) {
  const { t, i18n } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const enabled = klipyService.isEnabled()
  const { favorites, recents } = useGifCollections()
  const columnCount = isSmallScreen ? 2 : 3

  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  // Smart default: land on recents if any exist, else trending. On the very
  // first picker open after a page load, IndexedDB has not been hydrated yet
  // so the initializer sees an empty list — the effect below promotes the
  // tab to 'recent' once hydration completes, unless the user has interacted.
  const [activeTabId, setActiveTabId] = useState<TGifTabId>(() =>
    gifService.getRecents().length > 0 ? 'recent' : 'trending'
  )
  const userPickedTabRef = useRef(false)
  const handleTabChange = useCallback((id: TGifTabId) => {
    userPickedTabRef.current = true
    setActiveTabId(id)
  }, [])

  const [remoteItems, setRemoteItems] = useState<TGif[]>([])
  const [remoteNextPage, setRemoteNextPage] = useState<number | undefined>(undefined)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  useEffect(() => {
    gifService.hydrate().then(() => {
      if (userPickedTabRef.current) return
      if (gifService.getRecents().length > 0) {
        setActiveTabId('recent')
      }
    })
  }, [])

  const favoriteIds = useMemo(() => new Set(favorites.map((g) => g.id)), [favorites])

  // Whenever the active fetch context changes, reset and load the first page.
  // The fetch context is: search mode + (query OR trending tab). Local tabs
  // (favorites/recent) don't hit the network.
  const fetchContextKey = useMemo(() => {
    if (searchMode) return `search:${query.trim()}`
    if (activeTabId === 'trending') return 'trending'
    return null
  }, [searchMode, query, activeTabId])

  useEffect(() => {
    if (!enabled || fetchContextKey === null) {
      setRemoteItems([])
      setRemoteNextPage(undefined)
      setRemoteError(null)
      return
    }
    let cancelled = false
    const trimmedQuery = searchMode ? query.trim() : ''
    const handler = setTimeout(async () => {
      if (searchMode && !trimmedQuery) {
        setRemoteItems([])
        setRemoteNextPage(undefined)
        return
      }
      setRemoteLoading(true)
      setRemoteError(null)
      try {
        const result =
          searchMode && trimmedQuery
            ? await klipyService.search(trimmedQuery, {
                limit: PAGE_LIMIT,
                locale: i18n.language
              })
            : await klipyService.trending({
                limit: PAGE_LIMIT,
                locale: i18n.language
              })
        if (cancelled) return
        setRemoteItems(result.items)
        setRemoteNextPage(result.nextPage)
      } catch {
        if (!cancelled) setRemoteError(t('Failed to load GIFs'))
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    }, searchMode ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      cancelled = true
      clearTimeout(handler)
    }
  }, [enabled, fetchContextKey, searchMode, query, i18n.language, t])

  const loadMore = useCallback(async () => {
    if (!enabled || remoteLoading || !remoteNextPage) return
    if (searchMode && !query.trim()) return
    setRemoteLoading(true)
    try {
      const trimmedQuery = query.trim()
      const result =
        searchMode && trimmedQuery
          ? await klipyService.search(trimmedQuery, {
              limit: PAGE_LIMIT,
              page: remoteNextPage,
              locale: i18n.language
            })
          : await klipyService.trending({
              limit: PAGE_LIMIT,
              page: remoteNextPage,
              locale: i18n.language
            })
      setRemoteItems((prev) => [...prev, ...result.items])
      setRemoteNextPage(result.nextPage)
    } catch {
      // ignore — sentinel will retry on next intersection
    } finally {
      setRemoteLoading(false)
    }
  }, [enabled, remoteLoading, remoteNextPage, searchMode, query, i18n.language])

  const handlePick = useCallback(
    (gif: TGif) => {
      gifService.addRecent(gif)
      onGifClick(gif)
    },
    [onGifClick]
  )

  const exitSearch = useCallback(() => {
    setSearchMode(false)
    setQuery('')
  }, [])

  const localItems = useMemo<TGif[]>(() => {
    const source: TGifRecord[] =
      activeTabId === 'favorites' ? favorites : activeTabId === 'recent' ? recents : []
    return source.map((r) => ({
      id: r.id,
      slug: r.id,
      description: r.description,
      url: r.url,
      previewUrl: r.previewUrl,
      width: r.width,
      height: r.height
    }))
  }, [activeTabId, favorites, recents])

  if (!enabled) {
    return (
      <div className="flex h-[400px] w-full sm:h-[50vh] flex-col items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground sm:w-[480px]">
        {t('GIF picker is not configured. Set VITE_KLIPY_API_KEY to enable.')}
      </div>
    )
  }

  const showRemoteGrid = searchMode || activeTabId === 'trending'
  const emptyMessage = searchMode
    ? query.trim()
      ? remoteError ?? t('No GIFs found')
      : t('Type to search GIFs')
    : activeTabId === 'favorites'
      ? t('No favorite GIFs yet')
      : activeTabId === 'recent'
        ? t('No recent GIFs yet')
        : t('No GIFs found')

  return (
    <div className="flex h-[400px] w-full sm:h-[50vh] flex-col bg-background sm:w-[480px]">
      {searchMode ? (
        <div className="flex items-center gap-1 border-b px-1.5 py-1">
          <button
            type="button"
            onClick={exitSearch}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('Back')}
          >
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </button>
          <GifPickerSearch value={query} onChange={setQuery} autoFocus />
        </div>
      ) : (
        <GifPickerTabs
          activeTabId={activeTabId}
          onChange={handleTabChange}
          onSearchClick={() => setSearchMode(true)}
        />
      )}
      {showRemoteGrid ? (
        <GifGrid
          items={remoteItems}
          favoriteIds={favoriteIds}
          columnCount={columnCount}
          emptyMessage={emptyMessage}
          loading={remoteLoading}
          onPick={handlePick}
          onLoadMore={remoteNextPage ? loadMore : undefined}
        />
      ) : (
        <GifGrid
          items={localItems}
          favoriteIds={favoriteIds}
          columnCount={columnCount}
          emptyMessage={emptyMessage}
          onPick={handlePick}
        />
      )}
      <div className="border-t px-2 py-1 text-center text-[10px] text-muted-foreground">
        {t('Powered by KLIPY')}
      </div>
    </div>
  )
}
