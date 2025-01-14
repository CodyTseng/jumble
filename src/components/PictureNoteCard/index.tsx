import { extractFirstPictureFromPictureEvent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { tagNameEquals } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
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

export default function PictureNoteCard({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { push } = useSecondaryPage()
  const firstImage = extractFirstPictureFromPictureEvent(event)
  const title = useMemo(() => {
    const title = event.tags.find(tagNameEquals('title'))?.[1] ?? event.content
    return embedded(title, [
      embeddedNostrNpubRenderer,
      embeddedNostrProfileRenderer,
      embeddedHashtagRenderer
    ])
  }, [event])
  if (!firstImage) return null

  return (
    <div className={cn('space-y-1 cursor-pointer', className)} onClick={() => push(toNote(event))}>
      <Image className="rounded-lg w-full aspect-[6/8]" image={firstImage} />
      <div className="line-clamp-2 px-2 font-semibold">{title}</div>
      <div className="flex items-center gap-2 px-2">
        <UserAvatar userId={event.pubkey} size="xSmall" />
        <Username userId={event.pubkey} className="text-sm text-muted-foreground truncate" />
      </div>
    </div>
  )
}
