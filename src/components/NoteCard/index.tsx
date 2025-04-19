import { Skeleton } from '@/components/ui/skeleton'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import GenericNoteCard from './GenericNoteCard'
import RepostNoteCard from './RepostNoteCard'

export default function NoteCard({
  event,
  className,
  filterMutedNotes = true
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
}) {
  const { mutePubkeys } = useMuteList()
  if (filterMutedNotes && mutePubkeys.includes(event.pubkey)) {
    return null
  }

  if (event.kind === kinds.Repost) {
    return (
      <RepostNoteCard event={event} className={className} filterMutedNotes={filterMutedNotes} />
    )
  }
  return <GenericNoteCard event={event} className={className} />
}

export function NoteCardLoadingSkeleton({ isPictures }: { isPictures: boolean }) {
  const { t } = useTranslation()

  if (isPictures) {
    return <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  }

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
