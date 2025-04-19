import { useFetchEvent } from '@/hooks'
import { generateEventIdFromETag } from '@/lib/tag'
import { useNostr } from '@/providers/NostrProvider'
import { kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'

const SHOW_COUNT = 10

export default function BookmarkList() {
  const { t } = useTranslation()
  const { bookmarkListEvent } = useNostr()
  const eventIds = useMemo(() => {
    if (!bookmarkListEvent) return []

    return (
      bookmarkListEvent.tags
        .map((tag) => (tag[0] === 'e' ? generateEventIdFromETag(tag) : undefined))
        .filter(Boolean) as `nevent1${string}`[]
    ).reverse()
  }, [bookmarkListEvent])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const loadMore = () => {
      if (showCount < eventIds.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
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
  }, [showCount, eventIds])

  if (eventIds.length === 0) {
    return (
      <div className="mt-2 text-sm text-center text-muted-foreground">
        {t('no bookmarks found')}
      </div>
    )
  }

  return (
    <div>
      {eventIds.slice(0, showCount).map((eventId) => (
        <BookmarkedNote key={eventId} eventId={eventId} />
      ))}

      {showCount < eventIds.length ? (
        <div ref={bottomRef}>
          <NoteCardLoadingSkeleton isPictures={false} />
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground mt-2">
          {t('no more bookmarks')}
        </div>
      )}
    </div>
  )
}

function BookmarkedNote({ eventId }: { eventId: string }) {
  const { event, isFetching } = useFetchEvent(eventId)

  if (isFetching) {
    return <NoteCardLoadingSkeleton isPictures={false} />
  }

  if (!event || event.kind !== kinds.ShortTextNote) {
    return null
  }

  return <NoteCard event={event} className="w-full" />
}
