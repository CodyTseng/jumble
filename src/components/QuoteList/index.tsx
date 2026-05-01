import { ExtendedKind, SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useStuff } from '@/hooks/useStuff'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { getDefaultRelayUrls } from '@/lib/relay'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { Event, Filter, kinds } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import NoteList from '../NoteList'

export default function QuoteList({
  stuff,
  onCountChange
}: {
  stuff: Event | string
  onCountChange?: (count: number) => void
}) {
  const { event, externalContent } = useStuff(stuff)
  const { getMinTrustScore } = useUserTrust()
  const trustScoreThreshold = useMemo(
    () => getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS),
    [getMinTrustScore]
  )
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const relaySet = new Set(getDefaultRelayUrls())
      const filters: Filter[] = []
      if (event) {
        const relayList = await client.fetchRelayList(event.pubkey)
        relayList.read.slice(0, 5).forEach((url) => relaySet.add(url))
        const seenOn = client.getSeenEventRelayUrls(event.id)
        seenOn.forEach((url) => relaySet.add(url))

        const isReplaceable = isReplaceableEvent(event.kind)
        const key = isReplaceable ? getReplaceableCoordinateFromEvent(event) : event.id
        filters.push({
          '#q': [key],
          kinds: [
            kinds.ShortTextNote,
            kinds.LongFormArticle,
            ExtendedKind.COMMENT,
            ExtendedKind.POLL
          ]
        })
        if (isReplaceable) {
          filters.push({
            '#a': [key],
            kinds: [kinds.Highlights]
          })
        } else {
          filters.push({
            '#e': [key],
            kinds: [kinds.Highlights]
          })
        }
      }
      if (externalContent) {
        filters.push({
          '#r': [externalContent],
          kinds: [kinds.Highlights]
        })
      }
      if (cancelled) return
      const urls = Array.from(relaySet)
      setSubRequests(filters.map((filter) => ({ urls, filter })))
    }

    init()
    return () => {
      cancelled = true
    }
  }, [event, externalContent])

  return (
    <NoteList
      subRequests={subRequests}
      trustScoreThreshold={trustScoreThreshold}
      onFilteredCountChange={onCountChange}
    />
  )
}
