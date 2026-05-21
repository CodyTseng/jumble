import { useScreenSize } from '@/providers/ScreenSizeProvider'
import gifService, { useGifCollections } from '@/services/gif.service'
import klipyService, { TGif } from '@/services/klipy.service'
import { TGifRecord } from '@/types'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GifGrid from './GifGrid'
import GifTabs, { TGifTabId } from './GifTabs'
import PickerSearch from './PickerSearch'

const PAGE_LIMIT = 24
const SEARCH_DEBOUNCE_MS = 300

export default function GifContent({ onGifClick }: { onGifClick: (gif: TGif) => void }) {
  const { t, i18n } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const enabled = klipyService.isEnabled()
  const { favorites, recents } = useGifCollections()
  const columnCount = isSmallScreen ? 2 : 3

  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)
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
      width: r.width,
      height: r.height
    }))
  }, [activeTabId, favorites, recents])

  if (!enabled) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
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
    <div className="relative flex min-h-0 flex-1 flex-col">
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
          <PickerSearch
            value={query}
            onChange={setQuery}
            placeholder={t('Search GIFs')}
            autoFocus
          />
        </div>
      ) : (
        <GifTabs
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
      <span className="pointer-events-none absolute bottom-1.5 end-1.5 rounded-md border bg-background/95 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground shadow-sm backdrop-blur-sm">
        {t('Powered by KLIPY')}
      </span>
    </div>
  )
}
