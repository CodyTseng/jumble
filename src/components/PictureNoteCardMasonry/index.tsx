import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import PictureNoteCard from '../PictureNoteCard'

export function PictureNoteCardMasonry({
  events,
  columnCount,
  className
}: {
  events: Event[]
  columnCount: 2 | 3
  className?: string
}) {
  const columns = useMemo(() => {
    const newColumns: React.ReactNode[][] = Array.from({ length: columnCount }, () => [])
    events.forEach((event, i) => {
      newColumns[i % columnCount].push(
        <PictureNoteCard key={event.id} className="w-full" event={event} />
      )
    })
    return newColumns
  }, [events, columnCount])

  return (
    <div
      className={cn(
        'grid',
        columnCount === 2 ? 'grid-cols-2 gap-2' : 'grid-cols-3 gap-4',
        className
      )}
    >
      {columns.map((column, i) => (
        <div key={i} className={columnCount === 2 ? 'space-y-2' : 'space-y-4'}>
          {column}
        </div>
      ))}
    </div>
  )
}
