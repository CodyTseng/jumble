import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSharableEventId } from '@/lib/event'
import { toChachiChat } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Event, nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'
import Image from '../Image'

export default function GroupMetadataNote({
  event,
  className,
  originalNoteId
}: {
  event: Event
  className?: string
  originalNoteId?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const [isCopied, setIsCopied] = useState(false)
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

  return (
    <div className={cn('relative border rounded-lg', className)}>
      <div className="p-3 flex gap-2 items-start">
        {metadata.picture && (
          <Image image={{ url: metadata.picture }} className="h-32 aspect-square rounded-lg" />
        )}
        <div className="flex-1 w-0">
          <div className="text-xl font-semibold line-clamp-1">{metadata.name}</div>
          {metadata.about && (
            <div className="text-sm text-muted-foreground line-clamp-4 mt-1">{metadata.about}</div>
          )}
          {metadata.tags.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {metadata.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {(!metadata.relay || !metadata.d) && (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(originalNoteId ?? getSharableEventId(event))
                setIsCopied(true)
                setTimeout(() => setIsCopied(false), 2000)
              }}
              variant="ghost"
            >
              {isCopied ? <Check /> : <Copy />} Copy group ID
            </Button>
          )}
        </div>
      </div>
      {!isSmallScreen && metadata.relay && metadata.d && (
        <div
          className="absolute top-0 w-full h-full bg-muted/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center cursor-pointer transition-opacity opacity-0 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            window.open(toChachiChat(simplifyUrl(metadata.relay), metadata.d!), '_blank')
          }}
        >
          <div className="flex gap-2 items-center font-semibold">
            <ExternalLink className="size-4" /> Open in Chachi
          </div>
        </div>
      )}
    </div>
  )
}
