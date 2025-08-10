import NewNotesButton from '@/components/NewNotesButton'
import { Button } from '@/components/ui/button'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'

const SHOW_COUNT = 10

const NoteList = forwardRef(
  (
    {
      events,
      hasMore,
      loading,
      loadMore,
      newEvents = [],
      showNewEvents,
      onRefresh,
      filterMutedNotes
    }: {
      events: Event[]
      hasMore: boolean
      loading: boolean
      loadMore?: () => void
      newEvents?: Event[]
      showNewEvents?: () => void
      onRefresh?: () => void
      filterMutedNotes?: boolean
    },
    ref
  ) => {
    const { t } = useTranslation()
    const [showCount, setShowCount] = useState(SHOW_COUNT)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        scrollToTop: () => {
          topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }),
      []
    )

    const idSet = new Set<string>()

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 0.1
      }

      const _loadMore = async () => {
        if (showCount < events.length) {
          setShowCount((prev) => prev + SHOW_COUNT)
          // preload more
          if (events.length - showCount > 2 * SHOW_COUNT) {
            return
          }
        }

        if (loading || !hasMore) return
        loadMore?.()
      }

      const observerInstance = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          _loadMore()
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
    }, [loading, hasMore, events, loadMore])

    return (
      <div>
        {newEvents.length > 0 && <NewNotesButton newEvents={newEvents} onClick={showNewEvents} />}
        <div ref={topRef} className="scroll-mt-24" />
        <PullToRefresh
          onRefresh={async () => {
            onRefresh?.()
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }}
          pullingContent=""
        >
          <div className="min-h-screen">
            {events.slice(0, showCount).map((event) => {
              const id = isReplaceableEvent(event.kind)
                ? getReplaceableCoordinateFromEvent(event)
                : event.id

              if (idSet.has(id)) {
                return null
              }

              idSet.add(id)
              return (
                <NoteCard
                  key={event.id}
                  className="w-full"
                  event={event}
                  filterMutedNotes={filterMutedNotes}
                />
              )
            })}
            {hasMore || loading ? (
              <div ref={bottomRef}>
                <NoteCardLoadingSkeleton />
              </div>
            ) : events.length ? (
              <div className="text-center text-sm text-muted-foreground mt-2">
                {t('no more notes')}
              </div>
            ) : (
              <div className="flex justify-center w-full mt-2">
                <Button size="lg" onClick={onRefresh}>
                  {t('reload notes')}
                </Button>
              </div>
            )}
          </div>
        </PullToRefresh>
        <div className="h-40" />
      </div>
    )
  }
)
NoteList.displayName = 'NoteList'
export default NoteList

export type TNoteListRef = {
  scrollToTop: () => void
}
