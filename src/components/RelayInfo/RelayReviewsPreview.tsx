import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { compareEvents } from '@/lib/event'
import { getStarsFromRelayReviewEvent } from '@/lib/event-metadata'
import { toRelayReviews } from '@/lib/link'
import { cn, isTouchDevice } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { Filter, NostrEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Stars from '../Stars'
import RelayReviewCard from './RelayReviewCard'
import ReviewEditor from './ReviewEditor'

export default function RelayReviewsPreview({ relayUrl }: { relayUrl: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey, checkLogin } = useNostr()
  const { hideUntrustedNotes, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const [showEditor, setShowEditor] = useState(false)
  const [myReview, setMyReview] = useState<NostrEvent | null>(null)
  const [reviews, setReviews] = useState<NostrEvent[]>([])
  const [initialized, setInitialized] = useState(false)
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
      const events = await client.fetchEvents([relayUrl, ...BIG_RELAY_URLS], filters, {
        cache: true
      })

      const pubkeySet = new Set<string>()
      const reviews: NostrEvent[] = []
      let myReview: NostrEvent | null = null

      events.sort((a, b) => compareEvents(b, a))
      for (const evt of events) {
        if (
          mutePubkeySet.has(evt.pubkey) ||
          pubkeySet.has(evt.pubkey) ||
          (hideUntrustedNotes && !isUserTrusted(evt.pubkey))
        ) {
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
      setInitialized(true)
    }
    init()
  }, [relayUrl, pubkey, mutePubkeySet, hideUntrustedNotes, isUserTrusted])

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
            className={cn(
              'text-sm text-muted-foreground',
              count > 0 && 'underline cursor-pointer hover:text-foreground'
            )}
            onClick={() => {
              if (count > 0) {
                push(toRelayReviews(relayUrl))
              }
            }}
          >
            {t('{{count}} reviews', { count })}
          </div>
        </div>
        {!showEditor && !myReview && (
          <Button variant="outline" onClick={() => checkLogin(() => setShowEditor(true))}>
            {t('Write a review')}
          </Button>
        )}
      </div>

      {showEditor && <ReviewEditor relayUrl={relayUrl} onReviewed={handleReviewed} />}

      {myReview || reviews.length > 0 ? (
        <ReviewCarousel relayUrl={relayUrl} myReview={myReview} reviews={reviews} />
      ) : !showEditor ? (
        <div className="flex items-center justify-center text-sm text-muted-foreground p-4">
          {initialized ? t('No reviews yet. Be the first to write one!') : t('Loading...')}
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
    <Carousel
      opts={{
        skipSnaps: true
      }}
      plugins={[WheelGesturesPlugin()]}
    >
      <CarouselContent className="ml-4 mr-2">
        {myReview && (
          <Item key={myReview.id}>
            <RelayReviewCard event={myReview} className="border-primary/60 bg-primary/5" />
          </Item>
        )}
        {reviews.slice(0, 10).map((evt) => (
          <Item key={evt.id}>
            <RelayReviewCard event={evt} />
          </Item>
        ))}
        {reviews.length > 10 && (
          <Item>
            <div
              className="border rounded-lg bg-muted/20 p-3 flex items-center justify-center h-full hover:bg-muted cursor-pointer"
              onClick={() => push(toRelayReviews(relayUrl))}
            >
              <div className="text-sm text-muted-foreground">{t('View more reviews')}</div>
            </div>
          </Item>
        )}
      </CarouselContent>
      {showPreviousAndNext && <CarouselPrevious />}
      {showPreviousAndNext && <CarouselNext />}
    </Carousel>
  )
}

function Item({ children }: { children: React.ReactNode }) {
  const { enableSingleColumnLayout } = useUserPreferences()

  return (
    <CarouselItem
      className={cn(
        'basis-11/12 pl-0 pr-2',
        enableSingleColumnLayout ? 'md:basis-5/12 lg:basis-7/12' : 'lg:basis-2/3 2xl:basis-5/12'
      )}
    >
      {children}
    </CarouselItem>
  )
}
