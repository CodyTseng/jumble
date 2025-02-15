import { extractImageInfosFromEventTags } from '@/lib/event'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Images } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import {
  embedded,
  embeddedHashtagRenderer,
  embeddedNostrNpubRenderer,
  embeddedNostrProfileRenderer
} from '../Embedded'
import Image from '../Image'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import LikeButton from '../NoteStats/LikeButton'

export default function PictureNoteCard({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { push } = useSecondaryPage()
  const images = useMemo(() => extractImageInfosFromEventTags(event), [event])
  const title = useMemo(() => {
    const title = event.tags.find(tagNameEquals('title'))?.[1] ?? event.content
    return embedded(title, [
      embeddedNostrNpubRenderer,
      embeddedNostrProfileRenderer,
      embeddedHashtagRenderer
    ])
  }, [event])
  if (!images.length) return null

  return (
    <div className={cn('cursor-pointer relative', className)} onClick={() => push(toNote(event))}>
      <Image className="w-full aspect-[6/8] rounded-lg" image={images[0]} />
      {images.length > 1 && (
        <div className="absolute top-2 right-2 bg-background/50 rounded-full p-2">
          <Images size={16} />
        </div>
      )}
      <div className="p-2 space-y-1">
        <div className="line-clamp-2 font-semibold">{title}</div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 w-0">
            <UserAvatar userId={event.pubkey} size="xSmall" />
            <Username userId={event.pubkey} className="text-sm text-muted-foreground truncate" />
          </div>
          <LikeButton event={event} />
        </div>
      </div>
    </div>
  )
}
