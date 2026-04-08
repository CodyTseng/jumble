import ContentPreview from '@/components/ContentPreview'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import StuffStats from '@/components/StuffStats'
import TrustScoreBadge from '@/components/TrustScoreBadge'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar, { UserAvatarSkeleton } from '@/components/UserAvatar'
import Username from '@/components/Username'
import { NOTIFICATION_LIST_STYLE } from '@/constants'
import { toNote, toProfile } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useNotification } from '@/providers/NotificationProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { NostrEvent } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function Notification({
  icon,
  notificationId,
  sender,
  sentAt,
  description,
  middle = null,
  targetEvent,
  isNew = false,
  showStats = false
}: {
  icon: React.ReactNode
  notificationId: string
  sender: string
  sentAt: number
  description: string
  middle?: React.ReactNode
  targetEvent?: NostrEvent
  isNew?: boolean
  showStats?: boolean
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const { isNotificationRead, markNotificationAsRead } = useNotification()
  const { autoLoadProfilePicture } = useContentPolicy()
  const { notificationListStyle } = useUserPreferences()
  const unread = useMemo(
    () => isNew && !isNotificationRead(notificationId),
    [isNew, isNotificationRead, notificationId]
  )

  const handleClick = () => {
    markNotificationAsRead(notificationId)
    if (targetEvent) {
      push(toNote(targetEvent.id))
    } else if (pubkey) {
      push(toProfile(pubkey))
    }
  }

  if (notificationListStyle === NOTIFICATION_LIST_STYLE.COMPACT) {
    return (
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-2"
        onClick={handleClick}
      >
        <div className="flex w-0 flex-1 items-center gap-2">
          {autoLoadProfilePicture && (
            <div className="relative">
              <UserAvatar userId={sender} size="small" />
              <TrustScoreBadge
                pubkey={sender}
                classNames={{
                  container:
                    'absolute inset-0 w-full h-full rounded-full bg-background/60 backdrop-blur-sm flex flex-col justify-center items-center pointer-events-none'
                }}
              />
            </div>
          )}
          {icon}
          {!autoLoadProfilePicture && (
            <Username
              userId={sender}
              className="max-w-[8rem] shrink-0 truncate text-sm font-semibold"
            />
          )}
          {middle}
          {targetEvent && (
            <ContentPreview
              className={cn(
                'w-0 flex-1 truncate',
                unread ? 'font-semibold' : 'text-muted-foreground'
              )}
              event={targetEvent}
            />
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">
          <FormattedTimestamp timestamp={sentAt} short />
        </div>
      </div>
    )
  }

  return (
    <div
      className="clickable flex cursor-pointer items-start gap-2 border-b px-4 py-2"
      onClick={handleClick}
    >
      <div className="mt-1.5 flex items-center gap-2">
        {icon}
        <UserAvatar userId={sender} size="medium" />
      </div>
      <div className="w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <Username
              userId={sender}
              className="max-w-fit flex-1 truncate font-semibold"
              skeletonClassName="h-4"
            />
            <TrustScoreBadge pubkey={sender} />
            <div className="shrink-0 text-sm text-muted-foreground">{description}</div>
          </div>
          {unread && (
            <button
              className="m-0.5 size-3 shrink-0 rounded-full bg-primary transition-all hover:ring-4 hover:ring-primary/20"
              title={t('Mark as read')}
              onClick={(e) => {
                e.stopPropagation()
                markNotificationAsRead(notificationId)
              }}
            />
          )}
        </div>
        {middle}
        {targetEvent && (
          <ContentPreview
            className={cn('line-clamp-2', !unread && 'text-muted-foreground')}
            event={targetEvent}
          />
        )}
        <FormattedTimestamp timestamp={sentAt} className="shrink-0 text-sm text-muted-foreground" />
        {showStats && targetEvent && <StuffStats stuff={targetEvent} className="mt-1" />}
      </div>
    </div>
  )
}

export function NotificationSkeleton() {
  const { notificationListStyle } = useUserPreferences()

  if (notificationListStyle === NOTIFICATION_LIST_STYLE.COMPACT) {
    return (
      <div className="flex h-11 items-center gap-2 px-4 py-2">
        <UserAvatarSkeleton className="h-7 w-7" />
        <Skeleton className="h-6 w-0 flex-1" />
      </div>
    )
  }

  return (
    <div className="flex cursor-pointer items-start gap-2 px-4 py-2">
      <div className="mt-1.5 flex items-center gap-2">
        <Skeleton className="h-6 w-6" />
        <UserAvatarSkeleton className="h-9 w-9" />
      </div>
      <div className="w-0 flex-1">
        <div className="py-1">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="py-1">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="py-1">
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  )
}
