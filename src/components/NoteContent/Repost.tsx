import { Skeleton } from '@/components/ui/skeleton'
import { useRepostTarget } from '@/hooks'
import { cn } from '@/lib/utils'
import { Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import MainNoteCard from '../NoteCard/MainNoteCard'

export default function Repost({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { targetEvent, isResolving } = useRepostTarget(event)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-muted-foreground flex items-center gap-1 text-sm">
        <Repeat className="size-4 shrink-0" />
        <span>{t('Repost')}</span>
      </div>
      {targetEvent ? (
        <MainNoteCard event={targetEvent} embedded />
      ) : isResolving ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="text-muted-foreground text-sm">{t('Note not found')}</div>
      )}
    </div>
  )
}
