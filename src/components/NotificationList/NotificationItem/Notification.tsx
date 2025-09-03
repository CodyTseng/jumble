import ContentPreview from '@/components/ContentPreview'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
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
  isNew = false
}: {
  icon: React.ReactNode
  sender: string
  sentAt: number
  description: string
  middle?: React.ReactNode
  targetEvent?: NostrEvent
  isNew?: boolean
}) {
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()

  return (
    <div
      className="flex items-start gap-4 cursor-pointer py-2 px-4 border-b"
      onClick={() => {
        if (targetEvent) {
          push(toNote(targetEvent.id))
        } else if (pubkey) {
          push(toProfile(pubkey))
        }
      }}
    >
      <div className="flex gap-4 items-center mt-1.5">
        {icon}
        <UserAvatar userId={sender} size="medium" />
      </div>
      <div className="flex-1 w-0 flex flex-col gap-1">
        <div className="flex gap-1 items-center">
          <Username userId={sender} className="font-semibold" skeletonClassName="h-4" />
          <div className="shrink-0 text-muted-foreground text-sm">{description}</div>
        </div>
        {middle}
        {targetEvent && (
          <ContentPreview className="line-clamp-2 text-muted-foreground" event={targetEvent} />
        )}
        <FormattedTimestamp timestamp={sentAt} className="shrink-0 text-muted-foreground text-sm" />
      </div>
    </div>
  )
}
