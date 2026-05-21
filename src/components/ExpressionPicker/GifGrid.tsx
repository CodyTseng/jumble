import { cn } from '@/lib/utils'
import gifService from '@/services/gif.service'
import { TGif } from '@/services/klipy.service'
import { Heart } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export default function GifGrid({
  items,
  favoriteIds,
  columnCount,
  emptyMessage,
  loading,
  onPick,
  onLoadMore
}: {
  items: TGif[]
  favoriteIds: Set<string>
  columnCount: number
  emptyMessage?: string
  loading?: boolean
  onPick: (gif: TGif) => void
  onLoadMore?: () => void
}) {
  const { t } = useTranslation()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onLoadMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onLoadMore()
        }
      },
      { rootMargin: '120px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onLoadMore])

  const columns = useMemo(() => {
    const cols: TGif[][] = Array.from({ length: columnCount }, () => [])
    const heights = new Array<number>(columnCount).fill(0)
    items.forEach((gif) => {
      const ratio = gif.width > 0 && gif.height > 0 ? gif.height / gif.width : 1
      let minIdx = 0
      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < heights[minIdx]) minIdx = i
      }
      cols[minIdx].push(gif)
      heights[minIdx] += ratio
    })
    return cols
  }, [items, columnCount])

  if (items.length === 0 && !loading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        {emptyMessage ?? t('No GIFs found')}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-1.5 py-1">
      <div className="flex gap-1">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-1 flex-col gap-1">
            {col.map((gif) => (
              <GifCell
                key={gif.id}
                gif={gif}
                isFavorite={favoriteIds.has(gif.id)}
                onPick={onPick}
              />
            ))}
          </div>
        ))}
      </div>
      {loading && (
        <div className="text-muted-foreground flex items-center justify-center py-2 text-xs">
          {t('Loading...')}
        </div>
      )}
      {onLoadMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  )
}

function GifCell({
  gif,
  isFavorite,
  onPick
}: {
  gif: TGif
  isFavorite: boolean
  onPick: (gif: TGif) => void
}) {
  const { t } = useTranslation()
  const aspect = gif.height > 0 ? `${gif.width} / ${gif.height}` : '1 / 1'

  return (
    <button
      type="button"
      onClick={() => onPick(gif)}
      className="group bg-muted/40 relative block w-full overflow-hidden rounded-md transition-opacity hover:opacity-80"
      style={{ aspectRatio: aspect }}
      title={gif.description || undefined}
    >
      <img
        src={gif.url}
        alt={gif.description}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {gif.isAd && (
        <span className="pointer-events-none absolute start-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] leading-none font-semibold tracking-wide text-white uppercase">
          {t('Ad')}
        </span>
      )}
      <span
        role="button"
        tabIndex={-1}
        title={isFavorite ? t('Remove from favorites') : t('Add to favorites')}
        aria-label={isFavorite ? t('Remove from favorites') : t('Add to favorites')}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          gifService.toggleFavorite(gif)
        }}
        className={cn(
          'absolute end-1 top-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60',
          isFavorite && 'opacity-100'
        )}
      >
        <Heart className={cn('size-4', isFavorite && 'fill-red-500 text-red-500')} />
      </span>
    </button>
  )
}
