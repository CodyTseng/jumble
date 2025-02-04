import { checkAlgoRelay } from '@/lib/relay'
import relayInfoService from '@/services/relay-info.service'
import { TRelayInfo } from '@/types'
import { useEffect, useState } from 'react'

export function useFetchRelayInfos(urls: string[]) {
  const [isFetching, setIsFetching] = useState(true)
  const [relayInfos, setRelayInfos] = useState<(TRelayInfo | undefined)[]>([])
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)
  const [searchableRelayUrls, setSearchableRelayUrls] = useState<string[]>([])
  const urlsString = JSON.stringify(urls)

  useEffect(() => {
    const fetchRelayInfos = async () => {
      setIsFetching(true)
      if (urls.length === 0) {
        return setIsFetching(false)
      }
      const timer = setTimeout(() => {
        setIsFetching(false)
      }, 5000)
      try {
        const relayInfos = await relayInfoService.getRelayInfos(urls)
        setRelayInfos(relayInfos)
        setAreAlgoRelays(relayInfos.every((relayInfo) => checkAlgoRelay(relayInfo)))
        setSearchableRelayUrls(
          relayInfos
            .map((relayInfo, index) => ({
              url: urls[index],
              searchable: relayInfo?.supported_nips?.includes(50)
            }))
            .filter((relayInfo) => relayInfo.searchable)
            .map((relayInfo) => relayInfo.url)
        )
      } catch (err) {
        console.error(err)
      } finally {
        clearTimeout(timer)
        setIsFetching(false)
      }
    }

    fetchRelayInfos()
  }, [urlsString])

  return { relayInfos, isFetching, areAlgoRelays, searchableRelayUrls }
}
