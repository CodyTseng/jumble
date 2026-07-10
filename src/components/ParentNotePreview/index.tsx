import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks'
import { getEventAuthorPubkey } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import ContentPreview from '../ContentPreview'
import UserAvatar, { UserAvatarSkeleton } from '../UserAvatar'

export default function ParentNotePreview({
  eventId,
  externalContent,
  className,
  onClick,
  label
}: {
  eventId?: string
  externalContent?: string
  className?: string
  onClick?: React.MouseEventHandler<HTMLDivElement> | undefined
  label?: string
}) {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(eventId)
  const displayLabel = label ?? t('reply to')

  if (externalContent) {
    return (
      <div
        className={cn(
          'bg-muted text-muted-foreground hover:text-foreground flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-full px-2 text-sm',
          className
        )}
        onClick={onClick}
      >
        <div className="shrink-0">{displayLabel}</div>
        <div dir="auto" className="truncate">
          {externalContent}
        </div>
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
          'bg-muted text-muted-foreground flex w-44 max-w-full items-center gap-1 rounded-full px-2 text-sm',
          className
        )}
      >
        <div className="shrink-0">{displayLabel}</div>
        <UserAvatarSkeleton className="h-4 w-4" />
        <div className="flex-1 py-1">
          <Skeleton className="h-3" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground flex w-fit max-w-full items-center gap-1 rounded-full px-2 text-sm',
        event && 'hover:text-foreground cursor-pointer',
        className
      )}
      onClick={event ? onClick : undefined}
    >
      <div className="shrink-0">{displayLabel}</div>
      {event && (
        <UserAvatar className="shrink-0" userId={getEventAuthorPubkey(event)} size="tiny" />
      )}
      <ContentPreview className="truncate" event={event} />
    </div>
  )
}
