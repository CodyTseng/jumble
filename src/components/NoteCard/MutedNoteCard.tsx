import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Eye } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import { FormattedTimestamp } from '../FormattedTimestamp'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import RepostDescription from './RepostDescription'

export default function MutedNoteCard({
  event,
  show,
  reposter,
  embedded,
  className
}: {
  event: Event
  show: () => void
  reposter?: string
  embedded?: boolean
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <div className={cn(embedded ? 'p-2 sm:p-3 border rounded-lg' : 'px-4 py-3')}>
        <RepostDescription reposter={reposter} />
        <div className="flex items-center space-x-2">
          <UserAvatar userId={event.pubkey} size={embedded ? 'small' : 'normal'} />
          <div
            className={`flex-1 w-0 ${embedded ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
          >
            <Username
              userId={event.pubkey}
              className={cn('font-semibold flex truncate', embedded ? 'text-sm' : '')}
              skeletonClassName={embedded ? 'h-3' : 'h-4'}
            />
            <div className="text-xs text-muted-foreground line-clamp-1">
              <FormattedTimestamp timestamp={event.created_at} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-center text-muted-foreground font-medium my-4">
          <div>{t('This user has been muted')}</div>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              show()
            }}
            variant="outline"
          >
            <Eye />
            {t('Temporarily display this note')}
          </Button>
        </div>
      </div>
      {!embedded && <Separator />}
    </div>
  )
}
