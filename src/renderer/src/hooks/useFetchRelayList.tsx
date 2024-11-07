import { TRelayList } from '@renderer/types'
import { useEffect, useState } from 'react'
import client from '@renderer/services/client.service'

export function useFetchRelayList(pubkey?: string | null) {
  const [relayList, setRelayList] = useState<TRelayList>({ write: [], read: [] })

  useEffect(() => {
    const fetchRelayList = async () => {
      if (!pubkey) return
      try {
        const relayList = await client.fetchRelayList(pubkey)
        setRelayList(relayList)
      } catch (err) {
        console.error(err)
      }
    }

    fetchRelayList()
  }, [])

  return relayList
}
