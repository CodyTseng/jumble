import { tagNameEquals } from '@/lib/tag'
import { isWebsocketUrl, simplifyUrl } from '@/lib/url'
import client from '@/services/client.service'
import { TNip66RelayInfo, TRelayInfo } from '@/types'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayCard from './RelayCard'

const MONITOR = '9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923'
const MONITOR_RELAYS = ['wss://history.nostr.watch/']

export default function RelayList() {
  const { t } = useTranslation()
  const [relays, setRelays] = useState<TNip66RelayInfo[]>([])
  const [until, setUntil] = useState<number>(dayjs().unix())
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setUntil(dayjs().unix())
      const relayInfoEvents = await client.fetchEvents(MONITOR_RELAYS, {
        authors: [MONITOR],
        kinds: [30166],
        since: Math.round(Date.now() / 1000) - 60 * 60 * 2,
        limit: 100
      })
      const events = relayInfoEvents.sort((a, b) => b.created_at - a.created_at).slice(0, 100)
      const relays = formatRelayInfoEvents(events)
      setRelays(relays)
      setHasMore(events.length > 0)
      if (events.length > 0) {
        setUntil(events[events.length - 1].created_at - 1)
        setHasMore(true)
      } else {
        setHasMore(false)
      }
      setLoading(false)
    }
    init()
  }, [])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    const since = Math.round(Date.now() / 1000) - 60 * 60 * 2
    if (until < since) return

    setLoading(true)
    const relayInfoEvents = await client.fetchEvents(MONITOR_RELAYS, {
      authors: [MONITOR],
      kinds: [30166],
      since,
      until,
      limit: 100
    })
    const events = relayInfoEvents.sort((a, b) => b.created_at - a.created_at).slice(0, 100)
    setRelays((prev) => [...prev, ...formatRelayInfoEvents(events)])
    if (events.length > 0) {
      setUntil(events[events.length - 1].created_at - 1)
      setHasMore(true)
    } else {
      setHasMore(false)
    }
    setLoading(false)
  }, [loading, hasMore, until])

  useEffect(() => {
    if (loading) return

    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    }, options)

    const currentBottomRef = bottomRef.current

    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [loading, loadMore])

  return (
    <div>
      {relays.map((relay) => (
        <RelayCard key={relay.url} relayInfo={relay} />
      ))}
      <div className="text-center text-sm text-muted-foreground">
        {hasMore ? <div ref={bottomRef}>{t('loading...')}</div> : t('no more relays')}
      </div>
    </div>
  )
}

function formatRelayInfoEvents(relayInfoEvents: Event[]) {
  const urlSet = new Set<string>()
  const relayInfos: TNip66RelayInfo[] = []
  relayInfoEvents.forEach((event) => {
    const url = event.tags.find(tagNameEquals('d'))?.[1]
    if (!url || urlSet.has(url) || !isWebsocketUrl(url)) {
      return
    }

    urlSet.add(url)
    const basicInfo = event.content ? (JSON.parse(event.content) as TRelayInfo) : {}
    const tagInfo: Omit<TNip66RelayInfo, 'url' | 'shortUrl'> = {}
    console.log(event.tags)
    event.tags.forEach((tag) => {
      if (tag[0] === 'T') {
        tagInfo.relayType = tag[1]
      } else if (tag[0] === 'g' && tag[2] === 'countryCode') {
        tagInfo.countryCode = tag[1]
      }
    })
    relayInfos.push({
      ...basicInfo,
      ...tagInfo,
      url,
      shortUrl: simplifyUrl(url)
    })
  })
  return relayInfos
}
