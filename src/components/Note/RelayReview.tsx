import { getStarsFromRelayReviewEvent } from '@/lib/event-metadata'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import Content from '../Content'
import Stars from '../Stars'

export default function RelayReview({ event, className }: { event: Event; className?: string }) {
  const stars = useMemo(() => getStarsFromRelayReviewEvent(event), [event])

  return (
    <div className={className}>
      <Stars stars={stars} className="mt-2" />
      <Content event={event} className="mt-2" />
    </div>
  )
}
