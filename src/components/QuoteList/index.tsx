import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { useStuff } from '@/hooks/useStuff'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { Event, Filter, kinds } from 'nostr-tools'
import { useEffect, useState } from 'react'
import NoteList from '../NoteList'

export default function QuoteList({ stuff }: { stuff: Event | string }) {
  const { event, externalContent } = useStuff(stuff)
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    async function init() {
      const relaySet = new Set(BIG_RELAY_URLS)
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
      const urls = Array.from(relaySet)
      setSubRequests(filters.map((filter) => ({ urls, filter })))
    }

    init()
  }, [event])

  return <NoteList subRequests={subRequests} />
}
