import { PICTURE_EVENT_KIND } from '@/constants'
import { useFetchEvent } from '@/hooks'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Heart } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import ContentPreview from '../../ContentPreview'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'

export function ReactionNotification({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const eventId = useMemo(() => {
    const targetPubkey = notification.tags.findLast(tagNameEquals('p'))?.[1]
    if (targetPubkey !== pubkey) return undefined

    const eTag = notification.tags.findLast(tagNameEquals('e'))
    return eTag?.[1]
  }, [notification, pubkey])
  const { event } = useFetchEvent(eventId)
  if (!event || !eventId || ![kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(event.kind)) {
    return null
  }

  return (
    <div
      className="flex items-center justify-between cursor-pointer py-2"
      onClick={() => push(toNote(event))}
    >
      <div className="flex gap-2 items-center flex-1">
        <UserAvatar userId={notification.pubkey} size="small" />
        <div className="text-xl min-w-6 text-center">
          {!notification.content || notification.content === '+' ? (
            <Heart size={24} className="text-red-400" />
          ) : (
            notification.content
          )}
        </div>
        <ContentPreview
          className={cn('truncate flex-1 w-0', isNew ? 'font-semibold' : 'text-muted-foreground')}
          event={event}
        />
      </div>
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}
