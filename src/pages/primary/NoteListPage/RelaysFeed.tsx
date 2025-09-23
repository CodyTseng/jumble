import NormalFeed from '@/components/NormalFeed'
import { checkAlgoRelay } from '@/lib/relay'
import { useFeed } from '@/providers/FeedProvider'
import relayInfoService from '@/services/relay-info.service'
import { useEffect, useState } from 'react'

export default function RelaysFeed() {
  const { feedInfo, relayUrls } = useFeed()
  const [isReady, setIsReady] = useState(false)
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)

  useEffect(() => {
    const init = async () => {
      const relayInfos = await relayInfoService.getRelayInfos(relayUrls)
      setAreAlgoRelays(relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo)))
      setIsReady(true)
    }
    init()
  }, [relayUrls])

  if (!isReady) {
    return null
  }

  if (feedInfo.feedType !== 'relay' && feedInfo.feedType !== 'relays') {
    return null
  }

  return (
    <NormalFeed
      subRequests={[{ urls: relayUrls, filter: {} }]}
      areAlgoRelays={areAlgoRelays}
      isMainFeed
      showRelayCloseReason
    />
  )
}
