import { isReplyNoteEvent } from '@renderer/lib/event'
import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import NoteCard from '../NoteCard'

const NoteList = forwardRef(
  (
    {
      filter = {},
      className
    }: {
      filter?: Filter
      className?: string
    },
    ref
  ) => {
    const [events, setEvents] = useState<Event[]>([])
    const [noteFilter, setNoteFilter] = useState<Filter>({
      kinds: [kinds.ShortTextNote, kinds.Repost],
      limit: 50,
      until: dayjs().unix(),
      ...filter
    })
    const [hasMore, setHasMore] = useState<boolean>(true)
    const [refreshing, setRefreshing] = useState<boolean>(false)
    const [latestCreatedAt, setLatestCreatedAt] = useState<number>(0)
    const observer = useRef<IntersectionObserver | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)

    const loadMore = async () => {
      const events = await client.fetchEvents([noteFilter])
      if (events.length === 0) {
        setHasMore(false)
      }

      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
      const processedEvents = sortedEvents.filter((e) => !isReplyNoteEvent(e))
      if (processedEvents.length > 0) {
        setEvents((oldEvents) => [...oldEvents, ...processedEvents])
      }

      setLatestCreatedAt(sortedEvents[0].created_at)
      setNoteFilter({
        ...noteFilter,
        until: sortedEvents[sortedEvents.length - 1].created_at - 1
      })
    }

    useImperativeHandle(ref, () => ({
      addNewNotes: (newNotes: Event[]) => {
        const sortedEvents = newNotes.sort((a, b) => b.created_at - a.created_at)
        const processedEvents = sortedEvents.filter(
          (e) => e.created_at > latestCreatedAt && !isReplyNoteEvent(e)
        )
        setEvents((oldEvents) => [...processedEvents, ...oldEvents])
        setLatestCreatedAt(sortedEvents[0].created_at)
      },
      refresh: async () => {
        setRefreshing(true)
        const events = await client.fetchEvents([{ ...noteFilter, until: dayjs().unix() }])
        if (events.length === 0) {
          setHasMore(false)
          setLatestCreatedAt(dayjs().unix())
          setNoteFilter({
            ...noteFilter,
            until: dayjs().unix()
          })
          return
        }

        const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
        const processedEvents = sortedEvents.filter((e) => !isReplyNoteEvent(e))
        setEvents(processedEvents)
        if (processedEvents.length > 0) {
          setLatestCreatedAt(processedEvents[0].created_at)
          setNoteFilter({
            ...noteFilter,
            until: processedEvents[processedEvents.length - 1].created_at - 1
          })
        } else {
          setLatestCreatedAt(dayjs().unix())
          setNoteFilter({
            ...noteFilter,
            until: dayjs().unix()
          })
        }
        setRefreshing(false)
      }
    }))

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 1
      }

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      }, options)

      if (bottomRef.current) {
        observer.current.observe(bottomRef.current)
      }

      return () => {
        if (observer.current && bottomRef.current) {
          observer.current.unobserve(bottomRef.current)
        }
      }
    }, [noteFilter])

    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {refreshing && (
          <div className="text-center text-sm text-muted-foreground">refreshing...</div>
        )}
        {events.map((event, i) => (
          <NoteCard key={i} className="w-full" event={event} />
        ))}
        {hasMore ? (
          <div ref={bottomRef} className="text-center text-sm text-muted-foreground">
            loading...
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground">no more notes</div>
        )}
      </div>
    )
  }
)
NoteList.displayName = 'NoteList'
export default NoteList

export type TNoteListRef = {
  addNewNotes: (newNotes: Event[]) => void
  refresh: () => void
}
