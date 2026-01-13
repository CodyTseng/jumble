import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface UseInfiniteScrollOptions<T> {
  /**
   * The initial data items
   */
  items: T[]
  /**
   * Whether to initially show all items or use pagination
   * @default false
   */
  showAllInitially?: boolean
  /**
   * Number of items to show initially and load per batch
   * @default 10
   */
  showCount?: number
  /**
   * Initial loading state, which can be used to prevent loading more data until initial load is complete
   */
  initialLoading?: boolean
  /**
   * The function to load more data
   * Returns true if there are more items to load, false otherwise
   */
  onLoadMore: () => Promise<boolean>
  /**
   * IntersectionObserver options
   */
  observerOptions?: IntersectionObserverInit
}

export function useInfiniteScroll<T>({
  items,
  showAllInitially = false,
  showCount: initialShowCount = 10,
  onLoadMore,
  initialLoading = false,
  observerOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0
  }
}: UseInfiniteScrollOptions<T>) {
  const [hasMore, setHasMore] = useState(true)
  const [showCount, setShowCount] = useState(showAllInitially ? Infinity : initialShowCount)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({
    loading,
    hasMore,
    showCount,
    itemsLength: items.length,
    initialLoading
  })

  stateRef.current = {
    loading,
    hasMore,
    showCount,
    itemsLength: items.length,
    initialLoading
  }

  const loadMore = useCallback(async () => {
    const { loading, hasMore, showCount, itemsLength, initialLoading } = stateRef.current

    // If there are more items to show, increase showCount first
    if (showCount < itemsLength) {
      setShowCount((prev) => prev + initialShowCount)
      // Only fetch more data when remaining items are running low
      if (itemsLength - showCount > initialShowCount * 2) {
        return
      }
    }

    if (initialLoading || loading) return

    if (!hasMore) return
    setLoading(true)
    const newHasMore = await onLoadMore()
    setHasMore(newHasMore)
    setLoading(false)
  }, [onLoadMore, initialShowCount])

  // IntersectionObserver setup
  useEffect(() => {
    const currentBottomRef = bottomRef.current
    if (!currentBottomRef) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    }, observerOptions)

    observer.observe(currentBottomRef)

    return () => {
      observer.disconnect()
    }
  }, [loadMore, observerOptions])

  const visibleItems = useMemo(() => {
    return showAllInitially ? items : items.slice(0, showCount)
  }, [items, showAllInitially, showCount])

  const shouldShowLoadingIndicator = hasMore || showCount < items.length || loading

  return {
    visibleItems,
    loading,
    hasMore,
    shouldShowLoadingIndicator,
    bottomRef,
    setHasMore,
    setLoading,
    setShowCount
  }
}
