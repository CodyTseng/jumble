import type { TRelayList } from '@/types'
import client from '@/services/client.service'
import { useCallback, useState } from 'react'

export function useAccountRelayList() {
  const [relayList, setRelayListState] = useState<TRelayList | null>(null)
  const setRelayList = useCallback((list: TRelayList | null) => {
    // Initialization queries run immediately after this setter, before React effects.
    client.setOwnRelayUrls(list?.originalRelays.map(({ url }) => url) ?? [])
    setRelayListState(list)
  }, [])
  return [relayList, setRelayList] as const
}
