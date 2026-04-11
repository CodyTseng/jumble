import { UserAvatarSkeleton } from '@/components/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import ClientSelect from '../ClientSelect'
import MainNoteCard from '../NoteCard/MainNoteCard'

export function EmbeddedNote({ noteId, className }: { noteId: string; className?: string }) {
  const { event, isFetching } = useFetchEvent(noteId)

  if (isFetching) {
    return <EmbeddedNoteSkeleton className={className} />
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

function EmbeddedNoteSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('w-full rounded-xl border bg-card p-2 text-left sm:p-3', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2">
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

function EmbeddedNoteNotFound({ noteId, className }: { noteId: string; className?: string }) {
  const { t } = useTranslation()

  return (
    <div className={cn('rounded-xl border bg-card p-2 text-left sm:p-3', className)}>
      <div className="flex flex-col items-center gap-2 font-medium text-muted-foreground">
        <div>{t('Sorry! The note cannot be found 😔')}</div>
        <ClientSelect className="mt-2 w-full" originalNoteId={noteId} />
      </div>
    </div>
  )
}
