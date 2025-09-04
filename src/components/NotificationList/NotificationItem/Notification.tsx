import ContentPreview from '@/components/ContentPreview'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import NoteStats from '@/components/NoteStats'
import { Skeleton } from '@/components/ui/skeleton'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { toNote, toProfile } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { NostrEvent } from 'nostr-tools'

export default function Notification({
  icon,
  sender,
  sentAt,
  description,
  middle = null,
  targetEvent,
  isNew = false,
  showStats = false
}: {
  icon: React.ReactNode
  sender: string
  sentAt: number
  description: string
  middle?: React.ReactNode
  targetEvent?: NostrEvent
  isNew?: boolean
  showStats?: boolean
}) {
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()

  return (
    <div
      className="clickable flex items-start gap-2 cursor-pointer py-2 px-4 border-b"
      onClick={() => {
        if (targetEvent) {
          push(toNote(targetEvent.id))
        } else if (pubkey) {
          push(toProfile(pubkey))
        }
      }}
    >
      <div className="flex gap-2 items-center mt-1.5">
        {icon}
        <UserAvatar userId={sender} size="medium" />
      </div>
      <div className="flex-1 w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex gap-1 items-center">
            <Username
              userId={sender}
              className="flex-1 max-w-fit truncate font-semibold"
              skeletonClassName="h-4"
            />
            <div className="shrink-0 text-muted-foreground text-sm">{description}</div>
          </div>
          {isNew && <div className="size-2 bg-primary rounded-full shrink-0" />}
        </div>
        {middle}
        {targetEvent && (
          <ContentPreview className="line-clamp-2 text-muted-foreground" event={targetEvent} />
        )}
        <FormattedTimestamp timestamp={sentAt} className="shrink-0 text-muted-foreground text-sm" />
        {showStats && targetEvent && <NoteStats event={targetEvent} className="mt-1" />}
      </div>
    </div>
  )
}

export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-2 cursor-pointer py-2 px-4">
      <div className="flex gap-2 items-center mt-1.5">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>
      <div className="flex-1 w-0">
        <div className="py-1">
          <Skeleton className="w-16 h-4" />
        </div>
        <div className="py-1">
          <Skeleton className="w-full h-4" />
        </div>
        <div className="py-1">
          <Skeleton className="w-12 h-4" />
        </div>
      </div>
    </div>
  )
}
