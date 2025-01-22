import client from '@/services/client.service'
import { TRelayList } from '@/types'
import { useEffect, useState } from 'react'

export function useFetchRelayList(pubkey?: string | null) {
  const [relayList, setRelayList] = useState<TRelayList>({
    write: [],
    read: [],
    originalRelays: []
  })
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    const fetchRelayList = async () => {
      setIsFetching(true)
      if (!pubkey) {
        setIsFetching(false)
        return
      }
      try {
        const relayList = await client.fetchRelayList(pubkey)
        setRelayList(relayList)
      } catch (err) {
        console.error(err)
      } finally {
        setIsFetching(false)
      }
    }

    fetchRelayList()
  }, [pubkey])

  return { relayList, isFetching }
}
