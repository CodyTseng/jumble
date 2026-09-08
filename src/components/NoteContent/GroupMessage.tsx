import { Skeleton } from '@/components/ui/skeleton'
import { getGroupMetadataFromEvent } from '@/lib/event-metadata'
import { tagNameEquals } from '@/lib/tag'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import client from '@/services/client.service'
import { ExternalLink, MessagesSquare } from 'lucide-react'
import { Event, nip19 } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClientSelect from '../ClientSelect'
import Content from '../Content'
import Image from '../Image'

export default function GroupMessage({
  event,
  originalNoteId,
  className
}: {
  event: Event
  originalNoteId?: string
  className?: string
}) {
  const { t } = useTranslation()
  const { autoLoadMedia } = useContentPolicy()
  const groupId = event.tags.find(tagNameEquals('h'))?.[1]
  const [metadataEvent, setMetadataEvent] = useState<Event>()
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(!!groupId)
  const metadata = useMemo(
    () => (metadataEvent ? getGroupMetadataFromEvent(metadataEvent) : undefined),
    [metadataEvent]
  )

  useEffect(() => {
    let cancelled = false
    setMetadataEvent(undefined)
    setIsFetchingMetadata(!!groupId)
    if (!groupId) return

    const relayUrls = client.getSeenEventRelayUrls(event.id)
    if (originalNoteId) {
      try {
        const decoded = nip19.decode(originalNoteId)
        if (decoded.type === 'nevent' && decoded.data.id === event.id) {
          relayUrls.push(...(decoded.data.relays ?? []))
        }
      } catch {
        // A plain event ID has no relay hints.
      }
    }

    client
      .fetchGroupMetadata(groupId, relayUrls)
      .then((metadata) => {
        if (!cancelled) setMetadataEvent(metadata)
      })
      .catch((error) => console.error('Failed to fetch group metadata:', error))
      .finally(() => {
        if (!cancelled) setIsFetchingMetadata(false)
      })

    return () => {
      cancelled = true
    }
  }, [event.id, groupId, originalNoteId])

  return (
    <div className={className}>
      {groupId && (
        <div className="bg-muted/40 mb-3 flex items-center gap-2 rounded-lg px-3 py-2">
          {isFetchingMetadata ? (
            <Skeleton className="size-8 shrink-0 rounded-md" />
          ) : metadata?.picture && autoLoadMedia ? (
            <Image
              image={{ url: metadata.picture, pubkey: metadataEvent?.pubkey }}
              className="size-8 object-cover"
              classNames={{ wrapper: 'size-8 shrink-0 rounded-md' }}
              errorPlaceholder={<MessagesSquare className="text-muted-foreground size-4" />}
            />
          ) : (
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
              <MessagesSquare className="text-muted-foreground size-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-xs">NIP-29 · {t('Group message from')}</div>
            <div dir="auto" className="truncate text-sm font-medium">
              {metadata?.name ?? groupId}
            </div>
          </div>
          {metadataEvent && (
            <ClientSelect
              event={metadataEvent}
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8"
              aria-label={t('Open in another client')}
              title={t('Open in another client')}
            >
              <ExternalLink />
            </ClientSelect>
          )}
        </div>
      )}
      <Content event={event} enableHighlight />
    </div>
  )
}
