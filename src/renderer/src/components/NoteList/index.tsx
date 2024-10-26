import { cn } from '@renderer/lib/utils'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
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
    const observer = useRef<IntersectionObserver | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)

    const loadMore = useCallback(() => {
      let count = 0
      let until = noteFilter.until
      client.fetchEvents([noteFilter], {
        next: (newEvent) => {
          count++
          if (
            newEvent.kind === kinds.ShortTextNote &&
            newEvent.tags.some(([tagName]) => tagName === 'e')
          ) {
            return
          }
          setEvents((oldEvents) => [...oldEvents, newEvent])
          if (!until || newEvent.created_at < until) {
            until = newEvent.created_at
          }
        },
        complete: () => {
          if (count === 0) {
            setHasMore(false)
          }
          setNoteFilter({ ...noteFilter, until })
        }
      })
    }, [noteFilter])

    useImperativeHandle(ref, () => ({
      addNewNotes: (newNotes: Event[]) => {
        setEvents((oldEvents) => [...newNotes, ...oldEvents])
      },
      refresh: () => {
        setEvents([])
        setHasMore(true)
        setNoteFilter({ ...noteFilter, until: dayjs().unix() })
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
