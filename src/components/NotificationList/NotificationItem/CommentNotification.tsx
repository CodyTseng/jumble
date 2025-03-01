import { PICTURE_EVENT_KIND } from '@/constants'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { MessageCircle } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import ContentPreview from '../../ContentPreview'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'

export function CommentNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { push } = useSecondaryPage()
  const rootEventId = notification.tags.find(tagNameEquals('E'))?.[1]
  const rootPubkey = notification.tags.find(tagNameEquals('P'))?.[1]
  const rootKind = notification.tags.find(tagNameEquals('K'))?.[1]
  if (
    !rootEventId ||
    !rootPubkey ||
    !rootKind ||
    ![kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(parseInt(rootKind))
  ) {
    return null
  }

  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => push(toNote({ id: rootEventId, pubkey: rootPubkey }))}
    >
      <UserAvatar userId={notification.pubkey} size="small" />
      <MessageCircle size={24} className="text-blue-400" />
      <ContentPreview
        className={cn('truncate flex-1 w-0', isNew ? 'font-semibold' : 'text-muted-foreground')}
        event={notification}
      />
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}
