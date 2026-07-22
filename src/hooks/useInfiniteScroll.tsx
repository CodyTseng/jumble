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

  const fetchMore = useCallback(async () => {
    const { loading, initialLoading } = stateRef.current

    if (initialLoading || loading) return

    stateRef.current.loading = true
    setLoading(true)
    try {
      const newHasMore = await onLoadMore()
      stateRef.current.hasMore = newHasMore
      setHasMore(newHasMore)
    } catch (error) {
      console.error('Failed to load more items:', error)
      stateRef.current.hasMore = false
      setHasMore(false)
    } finally {
      stateRef.current.loading = false
      setLoading(false)
    }
  }, [onLoadMore])

  const loadMore = useCallback(async () => {
    const { hasMore, showCount, itemsLength } = stateRef.current

    // If there are more items to show, increase showCount first
    if (showCount < itemsLength) {
      setShowCount((prev) => prev + initialShowCount)
      // Only fetch more data when remaining items are running low
      if (itemsLength - showCount > initialShowCount * 2) {
        return
      }
    }

    if (!hasMore) return
    await fetchMore()
  }, [fetchMore, initialShowCount])

  const retryLoadMore = useCallback(async () => {
    await fetchMore()
  }, [fetchMore])

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
    retryLoadMore,
    setHasMore,
    setLoading,
    setShowCount
  }
}
