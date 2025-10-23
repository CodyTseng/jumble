import { getReplaceableEventIdentifier } from '@/lib/event'
import { getStarsFromRelayReviewEvent } from '@/lib/event-metadata'
import { toRelay } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import Stars from '../Stars'

export default function RelayReview({ event, className }: { event: Event; className?: string }) {
  const { push } = useSecondaryPage()
  const stars = useMemo(() => getStarsFromRelayReviewEvent(event), [event])
  const url = useMemo(() => getReplaceableEventIdentifier(event), [event])
  const simplifiedUrl = useMemo(() => simplifyUrl(url), [url])

  return (
    <div className={className}>
      <div className="mt-2 flex items-center gap-2">
        <Stars stars={stars} />
        <span className="text-sm text-muted-foreground">→</span>
        <div
          className="text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer truncate"
          onClick={(e) => {
            e.stopPropagation()
            push(toRelay(url))
          }}
        >
          {simplifiedUrl}
        </div>
      </div>
      <Content event={event} className="mt-2" />
    </div>
  )
}
