import relayInfoService from '@/services/relay-info.service'
import { TRelayInfo } from '@/types'
import { useEffect, useState } from 'react'

export function useFetchRelayInfo(url?: string) {
  const [isFetching, setIsFetching] = useState(true)
  const [relayInfo, setRelayInfo] = useState<TRelayInfo | undefined>(undefined)

  useEffect(() => {
    if (!url) return
    const fetchRelayInfos = async () => {
      setIsFetching(true)
      const timer = setTimeout(() => {
        setIsFetching(false)
      }, 5000)
      try {
        const relayInfo = await relayInfoService.getRelayInfo(url)
        setRelayInfo(relayInfo)
      } catch (err) {
        console.error(err)
      } finally {
        clearTimeout(timer)
        setIsFetching(false)
      }
    }

    fetchRelayInfos()
  }, [url])

  return { relayInfo, isFetching }
}
