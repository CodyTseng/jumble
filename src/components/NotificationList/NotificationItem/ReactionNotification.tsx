import { PICTURE_EVENT_KIND } from '@/constants'
import { useFetchEvent } from '@/hooks'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { useSecondaryPage } from '@/PageManager'
import { Heart, ThumbsUp } from 'lucide-react'
import { Event, kinds, nip19 } from 'nostr-tools'
import { useMemo } from 'react'
import { FormattedTimestamp } from '../../FormattedTimestamp'
import UserAvatar from '../../UserAvatar'
import { ContentPreview } from './ContentPreview'

export function ReactionNotification({ notification }: { notification: Event }) {
  const { push } = useSecondaryPage()
  const bech32Id = useMemo(() => {
    const eTag = notification.tags.findLast(tagNameEquals('e'))
    const pTag = notification.tags.find(tagNameEquals('p'))
    const eventId = eTag?.[1]
    const author = pTag?.[1]
    return eventId
      ? nip19.neventEncode(author ? { id: eventId, author } : { id: eventId })
      : undefined
  }, [notification])
  const { event } = useFetchEvent(bech32Id)
  if (!event || !bech32Id || ![kinds.ShortTextNote, PICTURE_EVENT_KIND].includes(event.kind)) {
    return null
  }

  return (
    <div
      className="flex items-center justify-between cursor-pointer py-2"
      onClick={() => push(toNote(bech32Id))}
    >
      <div className="flex gap-2 items-center flex-1">
        <UserAvatar userId={notification.pubkey} size="small" />
        <Heart size={24} className="text-red-400" />
        <div>{notification.content === '+' ? <ThumbsUp size={14} /> : notification.content}</div>
        <ContentPreview event={event} />
      </div>
      <div className="text-muted-foreground">
        <FormattedTimestamp timestamp={notification.created_at} short />
      </div>
    </div>
  )
}
