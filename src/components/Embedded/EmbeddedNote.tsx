import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GenericNoteCard from '../NoteCard/GenericNoteCard'

export function EmbeddedNote({ noteId, className }: { noteId: string; className?: string }) {
  const { event, isFetching } = useFetchEvent(noteId)

  if (isFetching) {
    return <EmbeddedNoteSkeleton className={className} />
  }

  if (!event) {
    return <EmbeddedNoteNotFound className={className} noteId={noteId} />
  }

  return (
    <GenericNoteCard
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
      className={cn('text-left p-2 sm:p-3 border rounded-lg', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2">
        <Skeleton className="w-16 h-7 rounded-full" />
        <Skeleton className="h-3 w-12 my-1" />
      </div>
      <Skeleton className="w-full h-4 my-1 mt-2" />
      <Skeleton className="w-2/3 h-4 my-1" />
    </div>
  )
}

function EmbeddedNoteNotFound({ noteId, className }: { noteId: string; className?: string }) {
  const { t } = useTranslation()
  const [isCopied, setIsCopied] = useState(false)

  return (
    <div className={cn('text-left p-2 sm:p-3 border rounded-lg', className)}>
      <div className="flex flex-col items-center text-muted-foreground font-medium gap-2">
        <div>{t('Sorry! The note cannot be found 😔')}</div>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.writeText(noteId)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
          }}
          variant="ghost"
        >
          {isCopied ? <Check /> : <Copy />} Copy note ID
        </Button>
      </div>
    </div>
  )
}
