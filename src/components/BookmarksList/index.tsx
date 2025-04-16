import { useFetchEvent } from '@/hooks'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { Loader, LockIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Note from '../Note'

export default function BookmarksList() {
  const { t } = useTranslation()
  const { bookmarks } = useBookmarks()
  const [visibleBookmarks, setVisibleBookmarks] = useState<
    { eventId: string; private: boolean; relayHint?: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  const bookmarkItems = useMemo(() => {
    return bookmarks
      .filter((tag) => tag[0] === 'e')
      .map((tag) => ({
        eventId: tag[1],
        private: tag.length > 4 && tag[4] === 'private',
        relayHint: tag.length > 2 ? tag[2] : undefined
      }))
      .reverse()
  }, [bookmarks])

  useEffect(() => {
    setVisibleBookmarks(bookmarkItems.slice(0, 10))
    setLoading(false)
  }, [bookmarkItems])

  const loadMore = () => {
    if (visibleBookmarks.length < bookmarkItems.length) {
      setVisibleBookmarks((prev) => [
        ...prev,
        ...bookmarkItems.slice(prev.length, prev.length + 10)
      ])
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="animate-spin size-8" />
      </div>
    )
  }

  if (bookmarkItems.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {t('No bookmarks found. Add some by clicking the bookmark icon on notes.')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleBookmarks.map((item) => (
        <BookmarkedNote key={item.eventId} eventId={item.eventId} isPrivate={item.private} />
      ))}

      {visibleBookmarks.length < bookmarkItems.length && (
        <div className="flex justify-center py-4">
          <button
            className="px-4 py-2 rounded bg-primary/10 hover:bg-primary/20 text-primary"
            onClick={loadMore}
          >
            {t('Load more')}
          </button>
        </div>
      )}
    </div>
  )
}

function BookmarkedNote({ eventId, isPrivate }: { eventId: string; isPrivate: boolean }) {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(eventId)

  if (isFetching) {
    return (
      <div className="p-4 border rounded animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-4 border rounded text-muted-foreground">
        {t('Note not found or deleted')}
      </div>
    )
  }

  return (
    <div className="p-4 border rounded">
      {isPrivate && (
        <div className="flex gap-1 items-center text-muted-foreground text-xs mb-2">
          <LockIcon size={12} />
          <span>{t('Private bookmark')}</span>
        </div>
      )}
      <Note event={event} fetchNoteStats />
    </div>
  )
}
