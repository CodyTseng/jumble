import NoteCard from '@/components/NoteCard'
import { Skeleton } from '@/components/ui/skeleton'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'

const SHOW_COUNT = 10

export default function TrendingNoteList() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  const [events, setEvents] = useState<Event[]>([])
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setHasMore(false)
    setLoading(true)
    client.fetchTrendingNotes(refreshCount > 0).then((events) => {
      setEvents(events)
      setLoading(false)
      setHasMore(true)
    })
  }, [refreshCount])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    if (showCount < events.length) {
      setShowCount((prev) => prev + SHOW_COUNT)
      return
    }
    setHasMore(false)
  }, [loading, hasMore, events, showCount])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
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
  }, [loadMore])

  return (
    <PullToRefresh
      onRefresh={async () => {
        setRefreshCount((count) => count + 1)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }}
      pullingContent=""
    >
      <div>
        <div>
          {events.slice(0, showCount).map((event) => (
            <NoteCard key={event.id} className="w-full" event={event} filterMutedNotes />
          ))}
        </div>
        {hasMore || loading ? (
          <div ref={bottomRef}>
            <LoadingSkeleton />
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground mt-2">{t('no more notes')}</div>
        )}
      </div>
    </PullToRefresh>
  )
}

function LoadingSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center space-x-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className={`flex-1 w-0`}>
          <div className="py-1">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="py-0.5">
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <div className="my-1">
          <Skeleton className="w-full h-4 my-1 mt-2" />
        </div>
        <div className="my-1">
          <Skeleton className="w-2/3 h-4 my-1" />
        </div>
      </div>
    </div>
  )
}
