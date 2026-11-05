import NoteCard from '@/components/NoteCard'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { TFeedTopicSnapshot } from '@/services/feed-topic.service'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const EMPTY_EVENTS: Event[] = []
const noMoreEvents = async () => false

export default function FeedTopicNotes({ snapshot }: { snapshot?: TFeedTopicSnapshot }) {
  const { t } = useTranslation()
  const { isEventDeleted } = useDeletedEvent()
  const events = useMemo(
    () => snapshot?.events.filter((event) => !isEventDeleted(event)) ?? EMPTY_EVENTS,
    [snapshot?.events, isEventDeleted]
  )
  // Paginate the saved sample locally; this list never requests another timeline.
  const { visibleItems, bottomRef } = useInfiniteScroll({ items: events, onLoadMore: noMoreEvents })

  if (!events.length) {
    return <div className="text-muted-foreground py-10 text-center">{t('No notes found')}</div>
  }

  return (
    <div className="min-h-screen">
      {visibleItems.map((event) => (
        <NoteCard key={event.id} className="w-full" event={event} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
