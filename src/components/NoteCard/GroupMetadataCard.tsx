import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getSharableEventId } from '@/lib/event'
import { toChachiChat } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Event, nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Image from '../Image'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import RepostDescription from './RepostDescription'

export default function GroupMetadataCard({
  event,
  className,
  originalNoteId,
  embedded = false,
  reposter
}: {
  event: Event
  className?: string
  originalNoteId?: string
  embedded?: boolean
  reposter?: string
}) {
  const { t } = useTranslation()
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
    <div className={cn('relative', className)}>
      <div className={cn(embedded ? 'p-2 sm:p-3 border rounded-lg' : 'px-4 py-3')}>
        <RepostDescription reposter={reposter} />
        <div className="flex items-center space-x-2">
          <UserAvatar userId={event.pubkey} size={embedded ? 'small' : 'normal'} />
          <div
            className={`flex-1 w-0 ${embedded ? 'flex space-x-2 items-center overflow-hidden' : ''}`}
          >
            <Username
              userId={event.pubkey}
              className={cn('font-semibold flex truncate', embedded ? 'text-sm' : '')}
              skeletonClassName={embedded ? 'h-3' : 'h-4'}
            />
            <div className="text-xs text-muted-foreground line-clamp-1">
              <FormattedTimestamp timestamp={event.created_at} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-start mt-2">
          {metadata.picture && (
            <Image image={{ url: metadata.picture }} className="h-32 aspect-square rounded-lg" />
          )}
          <div className="flex-1 w-0 space-y-1">
            <div className="text-xl font-semibold line-clamp-1">{metadata.name}</div>
            {metadata.about && (
              <div className="text-sm text-muted-foreground line-clamp-4">{metadata.about}</div>
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
      </div>
      {!embedded && <Separator />}
      {!isSmallScreen && metadata.relay && metadata.d && (
        <div
          className={cn(
            'absolute top-0 w-full h-full bg-muted/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer transition-opacity opacity-0 hover:opacity-100',
            embedded ? 'rounded-lg' : ''
          )}
          onClick={(e) => {
            e.stopPropagation()
            window.open(toChachiChat(simplifyUrl(metadata.relay), metadata.d!), '_blank')
          }}
        >
          <div className="flex gap-2 items-center font-semibold">
            <ExternalLink className="size-4" /> {t('Open in a', { a: 'Chachi' })}
          </div>
        </div>
      )}
    </div>
  )
}
