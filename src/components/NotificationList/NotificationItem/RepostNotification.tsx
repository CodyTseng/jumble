import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import client from '@/services/client.service'
import { Repeat } from 'lucide-react'
import { Event, validateEvent } from 'nostr-tools'
import { useMemo } from 'react'
import ContentPreview from '../../ContentPreview'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'

export function RepostNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { push } = useSecondaryPage()
  const event = useMemo(() => {
    try {
      const event = JSON.parse(notification.content) as Event
      const isValid = validateEvent(event)
      if (!isValid) return null
      client.addEventToCache(event)
      return event
    } catch {
      return null
    }
  }, [notification.content])
  if (!event) return null

  return (
    <div
      className="flex gap-2 items-center cursor-pointer py-2"
      onClick={() => push(toNote(event))}
    >
      <UserAvatar userId={notification.pubkey} size="small" />
      <Repeat size={24} className="text-green-400" />
      <ContentPreview
        className={cn('truncate flex-1 w-0', isNew ? 'font-semibold' : 'text-muted-foreground')}
        event={event}
      />
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}
