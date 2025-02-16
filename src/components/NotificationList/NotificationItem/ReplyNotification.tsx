import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { MessageCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'
import { ContentPreview } from './ContentPreview'

export function ReplyNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => push(toNote(notification))}
    >
      <UserAvatar userId={notification.pubkey} size="small" />
      <MessageCircle size={24} className="text-blue-400" />
      <ContentPreview event={notification} />
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}
