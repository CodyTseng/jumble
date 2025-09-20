import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BIG_RELAY_URLS } from '@/constants'
import { createRelayReviewDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { Loader2, Star } from 'lucide-react'
import { NostrEvent } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ReviewEditor({
  relayUrl,
  onReviewed
}: {
  relayUrl: string
  onReviewed: (evt: NostrEvent) => void
}) {
  const { t } = useTranslation()
  const { publish } = useNostr()
  const [stars, setStars] = useState(0)
  const [hoverStars, setHoverStars] = useState(0)
  const [review, setReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = useMemo(() => stars > 0 && !!review.trim(), [stars, review])

  const submit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const draftEvent = createRelayReviewDraftEvent(relayUrl, review, stars)
      const evt = await publish(draftEvent, { specifiedRelayUrls: [relayUrl, ...BIG_RELAY_URLS] })
      onReviewed(evt)
    } catch (error) {
      if (error instanceof AggregateError) {
        error.errors.forEach((e) => toast.error(`${t('Failed to review')}: ${e.message}`))
      } else if (error instanceof Error) {
        toast.error(`${t('Failed to review')}: ${error.message}`)
      }
      console.error(error)
      return
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 space-y-2">
      <Textarea
        className="min-h-36"
        placeholder={t('Write a review and pick a star rating')}
        value={review}
        onChange={(e) => setReview(e.target.value)}
      />
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="pr-2 cursor-pointer"
              onMouseEnter={() => setHoverStars(index + 1)}
              onMouseLeave={() => setHoverStars(0)}
            >
              {index < (hoverStars || stars) ? (
                <Star
                  className="size-6 text-yellow-400 fill-yellow-400"
                  onClick={() => setStars(index + 1)}
                />
              ) : (
                <Star
                  className="size-6 text-muted-foreground"
                  onClick={() => setStars(index + 1)}
                />
              )}
            </div>
          ))}
        </div>
        <Button
          disabled={!canSubmit}
          variant={canSubmit ? 'default' : 'secondary'}
          onClick={submit}
        >
          {submitting && <Loader2 className="animate-spin" />}
          {t('Submit')}
        </Button>
      </div>
    </div>
  )
}
