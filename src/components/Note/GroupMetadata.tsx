import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { Event, nip19 } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelectorDialog from '../ClientSelectorDialog'
import Image from '../Image'

export default function GroupMetadata({
  event,
  originalNoteId,
  className
}: {
  event: Event
  originalNoteId?: string
  className?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const metadata = useMemo(() => {
    let d: string | undefined
    let name: string | undefined
    let about: string | undefined
    let picture: string | undefined
    let relay: string | undefined
    const tags = new Set<string>()

    if (originalNoteId) {
      const pointer = nip19.decode(originalNoteId)
      if (pointer.type === 'naddr' && pointer.data.relays?.length) {
        relay = pointer.data.relays[0]
      }
    }
    if (!relay) {
      relay = client.getEventHint(event.id)
    }

    event.tags.forEach(([tagName, tagValue]) => {
      if (tagName === 'name') {
        name = tagValue
      } else if (tagName === 'about') {
        about = tagValue
      } else if (tagName === 'picture') {
        picture = tagValue
      } else if (tagName === 't' && tagValue) {
        tags.add(tagValue.toLocaleLowerCase())
      } else if (tagName === 'd') {
        d = tagValue
      }
    })

    if (!name) {
      name = d ?? 'no name'
    }

    return { d, name, about, picture, tags: Array.from(tags), relay }
  }, [event, originalNoteId])

  const groupNameComponent = (
    <div className="text-xl font-semibold line-clamp-1">{metadata.name}</div>
  )

  const groupAboutComponent = metadata.about && (
    <div className="text-sm text-muted-foreground line-clamp-4">{metadata.about}</div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {metadata.picture && (
          <Image
            image={{ url: metadata.picture }}
            className="w-full aspect-video object-cover rounded-lg"
            hideIfError
          />
        )}
        <div className="space-y-1">
          {groupNameComponent}
          {groupAboutComponent}
          <ClientSelectorDialog variant="secondary" className="w-full mt-2" event={event} />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        {metadata.picture && (
          <Image
            image={{ url: metadata.picture }}
            className="rounded-lg aspect-[4/3] xl:aspect-video object-cover bg-foreground h-44"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1 px-2">
          {groupNameComponent}
          {groupAboutComponent}
        </div>
      </div>
      <ClientSelectorDialog variant="secondary" className="w-full mt-2" event={event} />
    </div>
  )
}
