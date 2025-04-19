import Image from '@/components/Image'
import { ExtendedKind } from '@/constants'
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
  const reaction = useMemo(() => {
    if (!notification.content || notification.content === '+') {
      return <Heart size={24} className="text-red-400" />
    }

    const emojiName = /^:([^:]+):$/.exec(notification.content)?.[1]
    if (emojiName) {
      const emojiTag = notification.tags.find((tag) => tag[0] === 'emoji' && tag[1] === emojiName)
      const emojiUrl = emojiTag?.[2]
      if (emojiUrl) {
        return (
          <Image
            image={{ url: emojiUrl }}
            alt={emojiName}
            className="w-6 h-6"
            classNames={{ errorPlaceholder: 'bg-transparent' }}
            errorPlaceholder={<Heart size={24} className="text-red-400" />}
          />
        )
      }
    }
    return notification.content
  }, [notification])

  if (!event || !eventId || ![kinds.ShortTextNote, ExtendedKind.PICTURE].includes(event.kind)) {
    return null
  }

  return (
    <div
      className="flex items-center justify-between cursor-pointer py-2"
      onClick={() => push(toNote(event))}
    >
      <div className="flex gap-2 items-center flex-1">
        <UserAvatar userId={notification.pubkey} size="small" />
        <div className="text-xl min-w-6 text-center">{reaction}</div>
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
