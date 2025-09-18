import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel'
import { ExtendedKind } from '@/constants'
import { compareEvents } from '@/lib/event'
import { getStarsFromRelayReviewEvent } from '@/lib/event-metadata'
import { toRelayReviews } from '@/lib/link'
import { isTouchDevice } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Filter, NostrEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Stars from '../Stars'
import RelayReviewCard from './RelayReviewCard'
import ReviewEditor from './ReviewEditor'

export default function RelayReviewsPreview({ relayUrl }: { relayUrl: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const [showEditor, setShowEditor] = useState(false)
  const [myReview, setMyReview] = useState<NostrEvent | null>(null)
  const [reviews, setReviews] = useState<NostrEvent[]>([])
  const { stars, count } = useMemo(() => {
    let totalStars = 0
    let totalCount = 0
    ;[myReview, ...reviews].forEach((evt) => {
      if (!evt) return
      const stars = getStarsFromRelayReviewEvent(evt)
      if (stars) {
        totalStars += stars
        totalCount += 1
      }
    })
    return {
      stars: totalCount > 0 ? +(totalStars / totalCount).toFixed(1) : 0,
      count: totalCount
    }
  }, [myReview, reviews])

  useEffect(() => {
    const init = async () => {
      const filters: Filter[] = [
        { kinds: [ExtendedKind.RELAY_REVIEW], '#d': [relayUrl], limit: 100 }
      ]
      if (pubkey) {
        filters.push({ kinds: [ExtendedKind.RELAY_REVIEW], authors: [pubkey], '#d': [relayUrl] })
      }
      const events = await client.fetchEvents([relayUrl], filters)

      const pubkeySet = new Set<string>()
      const reviews: NostrEvent[] = []
      let myReview: NostrEvent | null = null

      events.sort((a, b) => compareEvents(b, a))
      for (const evt of events) {
        if (pubkeySet.has(evt.pubkey)) {
          continue
        }
        const stars = getStarsFromRelayReviewEvent(evt)
        if (!stars) {
          continue
        }

        pubkeySet.add(evt.pubkey)
        if (evt.pubkey === pubkey) {
          myReview = evt
        } else {
          reviews.push(evt)
        }
      }

      setMyReview(myReview)
      setReviews(reviews)
    }
    init()
  }, [relayUrl, pubkey])

  const handleReviewed = (evt: NostrEvent) => {
    setMyReview(evt)
    setShowEditor(false)
  }

  return (
    <div className="space-y-4">
      <div className="px-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{stars}</div>
            <Stars stars={stars} />
          </div>
          <div
            className="text-sm text-muted-foreground underline cursor-pointer hover:text-foreground"
            onClick={() => push(toRelayReviews(relayUrl))}
          >
            {t('{{count}} reviews', { count })}
          </div>
        </div>
        {!showEditor && !myReview && (
          <Button variant="outline" onClick={() => setShowEditor(true)}>
            {t('Write a review')}
          </Button>
        )}
      </div>

      {showEditor && <ReviewEditor relayUrl={relayUrl} onReviewed={handleReviewed} />}

      {myReview || reviews.length > 0 ? (
        <ReviewCarousel relayUrl={relayUrl} myReview={myReview} reviews={reviews} />
      ) : !showEditor ? (
        <div className="flex items-center justify-center text-sm text-muted-foreground p-4">
          {t('No reviews yet. Be the first to write one!')}
        </div>
      ) : null}
    </div>
  )
}

function ReviewCarousel({
  relayUrl,
  myReview,
  reviews
}: {
  relayUrl: string
  myReview: NostrEvent | null
  reviews: NostrEvent[]
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const showPreviousAndNext = useMemo(() => !isTouchDevice(), [])

  return (
    <Carousel>
      <CarouselContent className="ml-4 mr-2">
        {myReview && (
          <CarouselItem
            key={myReview.id}
            className="basis-11/12 sm:basis-2/3 md:basis-5/12 pl-0 pr-2"
          >
            <RelayReviewCard event={myReview} className="border-primary/60 bg-primary/5" />
          </CarouselItem>
        )}
        {reviews.slice(0, 10).map((evt) => (
          <CarouselItem key={evt.id} className="basis-11/12 sm:basis-2/3 md:basis-5/12 pl-0 pr-2">
            <RelayReviewCard event={evt} />
          </CarouselItem>
        ))}
        {reviews.length > 10 && (
          <CarouselItem className="basis-11/12 sm:basis-2/3 md:basis-5/12 pl-0 pr-2">
            <div
              className="border rounded-lg bg-muted/20 p-3 flex items-center justify-center h-full hover:bg-muted cursor-pointer"
              onClick={() => push(toRelayReviews(relayUrl))}
            >
              <div className="text-sm text-muted-foreground">{t('View more reviews')}</div>
            </div>
          </CarouselItem>
        )}
      </CarouselContent>
      {showPreviousAndNext && <CarouselPrevious />}
      {showPreviousAndNext && <CarouselNext />}
    </Carousel>
  )
}
