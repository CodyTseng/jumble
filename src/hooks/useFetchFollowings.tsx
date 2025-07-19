import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchFollowings(pubkey?: string | null) {
  const [followListEvent, setFollowListEvent] = useState<Event | null>(null)
  const [followings, setFollowings] = useState<string[]>([])
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        setIsFetching(true)
        if (!pubkey) return

        const event = await client.fetchFollowListEvent(pubkey)
        if (!event) return

        setFollowListEvent(event)
        setFollowings(getPubkeysFromPTags(event.tags))
      } finally {
        setIsFetching(false)
      }
    }

    init()
  }, [pubkey])

  return { followings, followListEvent, isFetching }
}
