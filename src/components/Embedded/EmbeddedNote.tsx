import { UserAvatarSkeleton } from '@/components/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import { cn } from '@/lib/utils'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClientSelect from '../ClientSelect'
import MainNoteCard from '../NoteCard/MainNoteCard'

export function EmbeddedNote({ noteId, className }: { noteId: string; className?: string }) {
  const { event, isFetching } = useFetchEvent(noteId)
  const skeletonRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (revealed || isFetching) return
    const el = skeletonRef.current
    if (!el) return
    // Only freeze skeleton if the element is above the viewport (already scrolled past).
    // If it's in view or still below, reveal immediately so the user sees real content
    // as they reach it.
    if (el.getBoundingClientRect().bottom > 0) {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setRevealed(true)
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [isFetching, revealed])

  if (!revealed) {
    return <EmbeddedNoteSkeleton ref={skeletonRef} className={className} />
  }

  if (!event) {
    return <EmbeddedNoteNotFound className={className} noteId={noteId} />
  }

  return (
    <MainNoteCard
      className={cn('w-full', className)}
      event={event}
      embedded
      originalNoteId={noteId}
    />
  )
}

const EmbeddedNoteSkeleton = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('w-full rounded-xl border bg-card p-2 text-start sm:p-3', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <UserAvatarSkeleton className="h-9 w-9" />
          <div>
            <Skeleton className="my-1 h-3 w-16" />
            <Skeleton className="my-1 h-3 w-16" />
          </div>
        </div>
        <Skeleton className="my-1 mt-2 h-4 w-full" />
        <Skeleton className="my-1 h-4 w-2/3" />
      </div>
    )
  }
)
EmbeddedNoteSkeleton.displayName = 'EmbeddedNoteSkeleton'

function EmbeddedNoteNotFound({ noteId, className }: { noteId: string; className?: string }) {
  const { t } = useTranslation()

  return (
    <div className={cn('rounded-xl border bg-card p-2 text-start sm:p-3', className)}>
      <div className="flex flex-col items-center gap-2 font-medium text-muted-foreground">
        <div>{t('Sorry! The note cannot be found 😔')}</div>
        <ClientSelect className="mt-2 w-full" originalNoteId={noteId} />
      </div>
    </div>
  )
}
