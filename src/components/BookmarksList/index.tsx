import { useFetchEvent } from '@/hooks'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { generateEventIdFromETag } from '@/lib/tag'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'

export default function BookmarksList() {
  const { t } = useTranslation()
  const { bookmarks } = useBookmarks()
  const [visibleBookmarks, setVisibleBookmarks] = useState<
    { eventId: string; neventId?: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const SHOW_COUNT = 10

  const bookmarkItems = useMemo(() => {
    return bookmarks
      .filter((tag) => tag[0] === 'e')
      .map((tag) => ({
        eventId: tag[1],
        neventId: generateEventIdFromETag(tag)
      }))
      .reverse()
  }, [bookmarks])

  useEffect(() => {
    setVisibleBookmarks(bookmarkItems.slice(0, SHOW_COUNT))
    setLoading(false)
  }, [bookmarkItems])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const loadMore = () => {
      if (visibleBookmarks.length < bookmarkItems.length) {
        setVisibleBookmarks((prev) => [
          ...prev,
          ...bookmarkItems.slice(prev.length, prev.length + SHOW_COUNT)
        ])
      }
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    }, options)

    const currentBottomRef = bottomRef.current

    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [visibleBookmarks, bookmarkItems])

  if (loading) {
    return <NoteCardLoadingSkeleton isPictures={false} />
  }

  if (bookmarkItems.length === 0) {
    return (
      <div className="mt-2 text-sm text-center text-muted-foreground">
        {t('No bookmarks found. Add some by clicking the bookmark icon on notes.')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleBookmarks.map((item) => (
        <BookmarkedNote key={item.eventId} eventId={item.eventId} neventId={item.neventId} />
      ))}

      {visibleBookmarks.length < bookmarkItems.length && (
        <div ref={bottomRef}>
          <NoteCardLoadingSkeleton isPictures={false} />
        </div>
      )}
    </div>
  )
}

function BookmarkedNote({ eventId, neventId }: { eventId: string; neventId?: string }) {
  const { event, isFetching } = useFetchEvent(neventId || eventId)

  if (isFetching) {
    return <NoteCardLoadingSkeleton isPictures={false} />
  }

  if (!event) {
    return null
  }

  return <NoteCard event={event} className="w-full" />
}
