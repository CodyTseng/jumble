import { useSecondaryPage } from '@/PageManager'
import { getStarsFromRelayReviewEvent } from '@/lib/event-metadata'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { NostrEvent } from 'nostr-tools'
import { useMemo } from 'react'
import ClientTag from '../ClientTag'
import ContentPreview from '../ContentPreview'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import Stars from '../Stars'
import TranslateButton from '../TranslateButton'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function RelayReviewCard({
  event,
  className
}: {
  event: NostrEvent
  className?: string
}) {
  const { push } = useSecondaryPage()
  const stars = useMemo(() => getStarsFromRelayReviewEvent(event), [event])

  return (
    <div
      className={cn('clickable h-full rounded-lg border bg-muted/20 p-3', className)}
      onClick={() => push(toNote(event))}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <SimpleUserAvatar userId={event.pubkey} size="medium" />
          <div className="w-0 flex-1">
            <div className="flex items-center gap-2">
              <SimpleUsername
                userId={event.pubkey}
                className="flex truncate text-sm font-semibold"
                skeletonClassName="h-3"
              />
              <ClientTag event={event} />
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Nip05 pubkey={event.pubkey} append="·" />
              <FormattedTimestamp timestamp={event.created_at} className="shrink-0" short />
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <TranslateButton event={event} className="pe-0" />
        </div>
      </div>
      <Stars stars={stars} className="mt-2 gap-0.5 [&_svg]:size-3" />
      <ContentPreview className="mt-2 line-clamp-4" event={event} />
    </div>
  )
}
