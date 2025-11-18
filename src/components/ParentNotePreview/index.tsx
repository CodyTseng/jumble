import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import ContentPreview from '../ContentPreview'
import UserAvatar from '../UserAvatar'

export default function ParentNotePreview({
  eventId,
  externalContent,
  className,
  onClick
}: {
  eventId?: string
  externalContent?: string
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined
}) {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(eventId)

  if (externalContent) {
    return (
      <div
        className={cn(
          'flex gap-1 items-center text-sm rounded-full px-2 bg-muted w-fit max-w-full text-muted-foreground hover:text-foreground cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        <div className="shrink-0">{t('reply to')}</div>
        <div className="truncate">{externalContent}</div>
      </div>
    )
  }

  if (!eventId) {
    return null
  }

  if (isFetching) {
    return (
      <div
        className={cn(
          'flex gap-1 items-center text-sm rounded-full px-2 bg-muted w-44 max-w-full text-muted-foreground',
          className
        )}
      >
        <div className="shrink-0">{t('reply to')}</div>
        <Skeleton className="w-4 h-4 rounded-full" />
        <div className="py-1 flex-1">
          <Skeleton className="h-3" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex gap-1 items-center text-sm rounded-full px-2 bg-muted w-fit max-w-full text-muted-foreground',
        event && 'hover:text-foreground cursor-pointer',
        className
      )}
      onClick={event ? onClick : undefined}
    >
      <div className="shrink-0">{t('reply to')}</div>
      {event && <UserAvatar className="shrink-0" userId={event.pubkey} size="tiny" />}
      <ContentPreview className="truncate" event={event} />
    </div>
  )
}
